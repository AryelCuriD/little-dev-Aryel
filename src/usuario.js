
import { setActivePage } from './global.js';

const menuItens = document.querySelectorAll('.menu-item');
const cards = document.querySelectorAll('.card-conteudo');

function ativarAba(indice) {
  menuItens.forEach(item => item.classList.remove('ativo'));
  cards.forEach(card => card.classList.remove('ativo'));
  menuItens[indice].classList.add('ativo');
  cards[indice].classList.add('ativo');
}

// Eventos
menuItens[0].addEventListener('click', () => ativarAba(0));
menuItens[1].addEventListener('click', () => ativarAba(1));

// Inicializa Perfil ativo
document.addEventListener('DOMContentLoaded', () => {
  ativarAba(0);
});