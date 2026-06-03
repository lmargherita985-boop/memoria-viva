/**
 * Impostazioni visive e di movimento — modifica solo questo file.
 * Ordine caduta: stessa sequenza di "memoria viva" (usa gli id del file SVG).
 */
window.MEMORIA_CONFIG = {
  /** Ordine di comparsa delle lettere (id dei path in Figma/SVG) */
  spawnOrder: [
    "m",
    "e",
    "m_2",
    "o",
    "r",
    "i",
    "a",
    "v",
    "i_2",
    "v_2",
    "a_2",
  ],

  colori: {
    sfondoPagina: "#f4f1eb",
    sfondoRiquadro: "#ffffff",
    bordoRiquadro: "#d4cfc4",
    lettere: "#030505",
  },

  riquadro: {
    larghezzaMassima: "min(920px, 96vw)",
    /** Rapporto larghezza:altezza (845×600 del disegno) */
    proporzione: "845 / 600",
  },

  movimento: {
    /** Più alto = caduta più veloce */
    gravita: 1.15,
    /** Rimbalzo: 0 = nessuno, 1 = molto (leggeri ≈ 0.45–0.55) */
    rimbalzo: 0.48,
    /** Attrito al contatto */
    attrito: 0.55,
    /** Millisecondi tra una lettera e la successiva */
    pausaTraLettere: 280,
    /** Quanto le lettere partono sparse in orizzontale (0 = stessa colonna) */
    dispersioneOrizzontale: 0.65,
    /** Rotazione casuale iniziale (gradi) */
    rotazioneInizialeMax: 18,
  },

  pulsanteRigioca: {
    testo: "Rigioca",
  },

  /** Se true, rispetta "riduci movimento" del sistema operativo */
  rispettaPreferenzaMovimento: true,

  viewBox: { width: 845, height: 600 },
};
