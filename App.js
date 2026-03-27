import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Text, View, StyleSheet, TextInput, Alert, TouchableOpacity, 
  ActivityIndicator, FlatList, Keyboard, Platform 
} from 'react-native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOMBRES_SIGNOS = {
  1: "Okana", 2: "Eyioko", 3: "Ogunda", 4: "Iroso", 
  5: "Oshé", 6: "Obara", 7: "Odí", 8: "Eyeunle", 
  9: "OSA", 10: "Ofun", 11: "Ojuani", 12: "Eyilá", 
  13: "Metanlá", 14: "Merinlá", 15: "Marunlá", 16: "Merindiloggun"
};

const MAYORES = [1, 2, 3, 4, 8, 12, 13, 14, 15, 16];

const COLORES = {
  nace: '#4CAF50', refran: '#03A9F4', habla: '#FF9800',
  prohibido: '#FF5252', titulo: '#FFD700', texto: '#AAAAAA'
};

const procesarTextoMaster = (texto) => {
  if (!texto) return [];
  const lineasRaw = texto.split('\n');
  let bloqueActualId = 0;
  let categoriaActual = 'texto';
  
  return lineasRaw.map((linea, index) => {
    const limpia = linea.trim().toLowerCase();
    if (/^\d+[-/ ]\d+/.test(limpia) || (limpia.includes('(') && limpia.includes(')'))) {
      bloqueActualId = index;
      categoriaActual = 'titulo';
    } 
    else if (limpia.includes('refrán:') || limpia.includes('refran:')) categoriaActual = 'refran';
    else if (limpia.includes('nace:')) categoriaActual = 'nace';
    else if (limpia.includes('habla:') || limpia.includes('dice:')) categoriaActual = 'habla';
    else if (limpia.includes('prohibido:')) categoriaActual = 'prohibido';

    return { texto: linea, categoria: categoriaActual, id: index, bloqueId: bloqueActualId };
  });
};

export default function App() {
  const [cuerpoTratado, setCuerpoTratado] = useState(''); 
  const [busqueda, setBusqueda] = useState('');
  const [lineasProcesadas, setLineasProcesadas] = useState([]);
  const [filtroColor, setFiltroColor] = useState('todos'); 
  const [signoActivoId, setSignoActivoId] = useState(null);
  const [infoSigno, setInfoSigno] = useState({ nombre: "", mano: "" });
  const [cargando, setCargando] = useState(true);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const OPCIONES_VOZ = {
    language: 'es-ES',
    rate: 0.9, 
    pitch: 1.0
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        const valor = await AsyncStorage.getItem('@tratado_key');
        if (valor) {
          setCuerpoTratado(valor);
          setLineasProcesadas(procesarTextoMaster(valor));
        } else { setModoEdicion(true); }
      } catch (e) { console.log("Error al cargar"); }
      finally { setCargando(false); }
    };
    cargar();
  }, []);

  const obtenerNombreSigno = (texto) => {
    const numeros = texto.match(/\d+/g);
    if (numeros && numeros.length >= 2) {
      const n1 = parseInt(numeros[0]);
      const n2 = parseInt(numeros[1]);
      const nombre1 = NOMBRES_SIGNOS[n1] || n1;
      const nombre2 = NOMBRES_SIGNOS[n2] || n2;
      if (nombre1 === nombre2) return `${nombre1} MEYI`.toUpperCase();
      return `${nombre1} ${nombre2}`.toUpperCase();
    }
    return "SIGNO";
  };

  const calcularMano = (texto) => {
    const numeros = texto.match(/\d+/g);
    if (numeros && numeros.length >= 2) {
      const n1 = parseInt(numeros[0]);
      const n2 = parseInt(numeros[1]);
      if (n1 === 7 && n2 === 6) return "👉 DERECHA (INVERSO)";
      if (n1 === 6 && n2 === 7) return "👈 IZQUIERDA (INVERSO)";
      if (n1 === 9 && n2 === 12) return "👉 DERECHA (EXC)";
      if (n1 === n2) return "👐 MEYI (SEGÚN SIGNO)";
      const n1EsMayor = MAYORES.includes(n1);
      const n2EsMayor = MAYORES.includes(n2);
      if (!n1EsMayor && n2EsMayor) return "👉 DERECHA (ASC)";
      if (n1EsMayor && !n2EsMayor) return "👈 IZQUIERDA (DESC)";
      return n1 < n2 ? "👉 DERECHA" : "👈 IZQUIERDA";
    }
    return null;
  };

  const consultarSigno = () => {
    Keyboard.dismiss();
    const t = busqueda.trim().toLowerCase();
    if (!t) return;
    const terminoLimpio = t.replace(/[/ ]/g, '-');
    const idx = lineasProcesadas.findIndex(l => 
      l.categoria === 'titulo' && l.texto.toLowerCase().includes(terminoLimpio)
    );
    if (idx !== -1) {
      const tituloOriginal = lineasProcesadas[idx].texto;
      const nombreTraducido = obtenerNombreSigno(tituloOriginal);
      setSignoActivoId(lineasProcesadas[idx].bloqueId);
      setInfoSigno({ nombre: nombreTraducido, mano: calcularMano(tituloOriginal) });
      setFiltroColor('todos');
      setBusqueda('');
      detenerVoz();
      Speech.speak(nombreTraducido, OPCIONES_VOZ);
    } else {
      Alert.alert("No encontrado", "Signo no disponible.");
    }
  };

  // --- FUNCIÓN CORREGIDA ---
  const togglePlayPause = async () => {
    const yaHablando = await Speech.isSpeakingAsync();

    if (isSpeaking || yaHablando) {
      // En Android, pause() no funciona. Usamos stop() para asegurar compatibilidad.
      await Speech.stop();
      setIsSpeaking(false);
    } else {
      const textoALeer = datosVisibles.map(item => item.texto).join('. ');
      if (textoALeer) {
        setIsSpeaking(true);
        Speech.speak(textoALeer, { 
          ...OPCIONES_VOZ,
          onDone: () => setIsSpeaking(false),
          onStopped: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false)
        });
      }
    }
  };

  const detenerVoz = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  const datosVisibles = useMemo(() => {
    if (signoActivoId === null) return lineasProcesadas;
    const soloSigno = lineasProcesadas.filter(item => item.bloqueId === signoActivoId);
    return filtroColor === 'todos' ? soloSigno : soloSigno.filter(item => item.categoria === filtroColor);
  }, [signoActivoId, lineasProcesadas, filtroColor]);

  if (cargando) return <View style={styles.loader}><ActivityIndicator size="large" color="#FFD700" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.tituloApp}>DILOGGUN SEARCH PRO</Text>
        {!modoEdicion ? (
          <View style={styles.searchRow}>
            <TextInput style={styles.inputBusqueda} placeholder="Ej: 5-5 o 10/4" placeholderTextColor="#666" 
              onChangeText={setBusqueda} value={busqueda} onSubmitEditing={consultarSigno}/>
            <TouchableOpacity style={styles.botonOro} onPress={consultarSigno}>
              <Text style={styles.btnTextNegro}>IR</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.botonVerde} onPress={() => {
            AsyncStorage.setItem('@tratado_key', cuerpoTratado);
            setLineasProcesadas(procesarTextoMaster(cuerpoTratado));
            setModoEdicion(false);
          }}>
            <Text style={styles.btnTextNegro}>💾 GUARDAR TRATADO</Text>
          </TouchableOpacity>
        )}
      </View>

      {!modoEdicion && signoActivoId !== null && (
        <View style={styles.containerFiltros}>
          <View style={styles.bannerActivo}>
            <View style={{flex: 1}}>
              <Text style={styles.txtNombreSigno}>{infoSigno.nombre}</Text>
              <Text style={styles.txtOriginal}>({lineasProcesadas.find(l => l.id === signoActivoId)?.texto})</Text>
              {infoSigno.mano && <Text style={styles.txtMano}>{infoSigno.mano}</Text>}
            </View>
            <TouchableOpacity onPress={() => setSignoActivoId(null)}>
              <Text style={styles.txtCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.filtrosRow}>
            {['todos', 'nace', 'refran', 'habla', 'prohibido'].map(f => (
              <TouchableOpacity key={f} onPress={() => setFiltroColor(f)} 
                style={[styles.chip, { borderColor: COLORES[f] || '#333' }, filtroColor === f && { backgroundColor: COLORES[f] || '#FFD700' }]}>
                <Text style={{ fontSize: 9, color: filtroColor === f ? '#000' : (COLORES[f] || '#888'), fontWeight: 'bold' }}>{f.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {modoEdicion ? (
        <TextInput style={styles.inputCarga} multiline onChangeText={setCuerpoTratado} value={cuerpoTratado} placeholder="Pega tu tratado aquí..." placeholderTextColor="#333" />
      ) : (
        <FlatList data={datosVisibles} keyExtractor={(item) => item.id.toString()} initialNumToRender={40}
          renderItem={({ item }) => (
            <View style={[styles.linea, item.categoria === 'titulo' && styles.lineaTitulo]}>
              <Text style={{ color: COLORES[item.categoria] || '#AAA', fontSize: item.categoria === 'titulo' ? 18 : 14, fontWeight: item.categoria === 'titulo' ? 'bold' : 'normal' }}>
                {item.texto}
              </Text>
            </View>
          )}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnNav} onPress={() => setModoEdicion(!modoEdicion)}>
          <Text style={styles.btnText}>{modoEdicion ? "CERRAR" : "EDITAR"}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.btnNav, {backgroundColor: isSpeaking ? '#FF9800' : '#4CAF50'}]} onPress={togglePlayPause}>
          <Text style={styles.btnTextNegro}>{isSpeaking ? "⏹ DETENER" : "▶ LEER"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btnNav, {backgroundColor: '#800'}]} onPress={detenerVoz}>
          <Text style={styles.btnText}>⏹ PARAR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 15, paddingTop: 45, backgroundColor: '#0a0a0a' },
  tituloApp: { color: '#FFD700', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  searchRow: { flexDirection: 'row', marginBottom: 10 },
  inputBusqueda: { flex: 1, backgroundColor: '#1a1a1a', color: '#fff', padding: 10, borderRadius: 8, marginRight: 8 },
  botonOro: { backgroundColor: '#FFD700', paddingHorizontal: 15, borderRadius: 8, justifyContent: 'center' },
  botonVerde: { backgroundColor: '#4CAF50', padding: 12, borderRadius: 8, alignItems: 'center' },
  containerFiltros: { backgroundColor: '#111', padding: 12, borderBottomWidth: 1, borderColor: '#333' },
  bannerActivo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  txtNombreSigno: { color: '#FFD700', fontSize: 20, fontWeight: 'bold' },
  txtOriginal: { color: '#666', fontSize: 12, marginBottom: 4 },
  txtMano: { color: '#FFF', fontSize: 13, fontWeight: 'bold', backgroundColor: '#333', alignSelf: 'flex-start', paddingHorizontal: 8, borderRadius: 4, marginTop: 4 },
  txtCerrar: { color: '#666', fontWeight: 'bold', fontSize: 20 },
  filtrosRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 5 },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, margin: 2, backgroundColor: '#000', borderWidth: 1 },
  inputCarga: { flex: 1, color: '#00FF00', backgroundColor: '#050505', padding: 20, textAlignVertical: 'top' },
  linea: { paddingHorizontal: 20, paddingVertical: 4 },
  lineaTitulo: { borderBottomWidth: 1, borderBottomColor: '#333', marginTop: 15, backgroundColor: '#0a0a0a', paddingBottom: 5 },
  footer: { flexDirection: 'row', padding: 12, backgroundColor: '#0a0a0a' },
  btnNav: { flex: 1, backgroundColor: '#222', padding: 10, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  btnTextNegro: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }
});
