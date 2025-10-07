/*async function listarSalas() {
    const res = await fetch('http://localhost:8080/reservas');
    const salas = await res.json();
    console.log(salas);
  }
*/

function setActivePage() {
    let currentPage = window.location.pathname.split('/').pop();
    if (currentPage === '') {
        currentPage = 'home'; // Default para root '/'
    }
    const links = document.querySelectorAll('.paginas a');
    
    links.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === currentPage) {
            link.classList.add('active');
        }
    });
}

function paginaUsuario() {
    window.location.href = '/usuario';
}

document.querySelectorAll('.paginas a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = link.getAttribute('href');
    });
});

document.addEventListener('DOMContentLoaded', setActivePage);