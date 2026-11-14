// Extra layout rules injected into the book at load time (the HTML file itself stays unchanged).
// Placed at the end of <head> so they win over the file's own rules of equal specificity.
export const BOOK_RESPONSIVE_CSS = `
html{-webkit-text-size-adjust:100%}
@media (max-width:640px){
  header{padding:8px 10px}
  .bar{gap:5px}
  h1{font-size:15px;margin-right:4px}
  .bar>button{font-size:13px;padding:4px 9px}
  #q{order:1;flex:1 1 100%;min-width:0}
  #st{font-size:11px}
  #nav{padding-top:6px;scrollbar-width:none}
  #nav a{font-size:12px;padding:3px 9px}
  main{padding:8px 10px 72px}
  section{margin-top:18px}
  .sh h2{font-size:16px}
  .grid{grid-template-columns:1fr;gap:8px}
  dialog{width:96vw;max-height:90dvh}
  #full{height:60vh}
}
@media (min-width:1600px){main{max-width:1480px}}
@media (pointer:coarse){
  .bar>button,.sh button{min-height:36px}
  .tools{opacity:1}
  .tools button,.tools select{min-height:32px;padding:4px 10px;font-size:13px}
  .chip{padding:3px 4px 3px 10px}
  .chip b{padding:2px 8px}
  #q,dialog textarea,#full{font-size:16px}
  button:hover{border-color:var(--bd)}
}
`;
