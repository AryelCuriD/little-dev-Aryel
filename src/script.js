async function listarSalas() {
    const res = await fetch('http://localhost:8080/salas');
    const salas = await res.json();
    console.log(salas);
  }
  