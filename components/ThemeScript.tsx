/**
 * Sets the theme attribute before hydration to avoid a flash.
 * Stored preference: localStorage "fa-theme" = "dark" | "light" | "system".
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem("fa-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
