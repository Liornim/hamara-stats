window.CARD={
  rank:c=>'23456789TJQKA'[c>>2].replace('T','10'),
  suit:c=>'♠♥♦♣'[c&3],
  suitCls:c=>['sp','he','di','cl'][c&3],
  html:c=>`<span class="card ${['sp','he','di','cl'][c&3]}"><b>${'23456789TJQKA'[c>>2].replace('T','10')}</b><i>${'♠♥♦♣'[c&3]}</i></span>`
};
