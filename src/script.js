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



function abrirNotificacoes() {
    document.getElementById("overlay").style.display = "block";
    document.getElementById("notificacoes").style.display = "block";
  }
  
  function fecharNotificacoes() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("notificacoes").style.display = "none";
  }
  

  // === TROCA ENTRE PERFIL E PREFERÊNCIAS === //
document.addEventListener('DOMContentLoaded', () => {
  const menuItems = document.querySelectorAll('.menu-item');
  const cards = document.querySelectorAll('.card-conteudo');

  menuItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      // Remove classe "ativo" de todos
      menuItems.forEach(i => i.classList.remove('ativo'));
      cards.forEach(c => c.classList.remove('ativo'));

      // Ativa o selecionado
      item.classList.add('ativo');
      cards[index].classList.add('ativo');
    });
  });
});

async function carregarEstatisticasDashboard() {
  try {
    const response = await fetch('http://localhost:8080/api/dashboard');
    const data = await response.json();

    document.getElementById('salas-disponiveis').textContent = data.salasDisponiveis;
    document.getElementById('labs-disponiveis').textContent = data.labsDisponiveis;
    document.getElementById('reservas-ativas').textContent = data.reservasAtivas;
    document.getElementById('devolucoes-pendentes').textContent = data.devolucoesPendentes;
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
}

// Chamar quando a página carregar
document.addEventListener('DOMContentLoaded', carregarEstatisticasDashboard);
