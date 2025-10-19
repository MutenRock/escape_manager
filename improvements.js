// This script augments the Escape Manager game with additional features
// without modifying the core game files. It injects a pause/resume button
// into the statistics panel and toggles the GameState.paused flag when clicked.
// The button is disabled when the management overlay is open, to avoid
// conflicts with the end-of-day recap.

(function(){
  // Wait until the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const statsPanel = document.getElementById('statsPanel');
    if (!statsPanel) return;

    // Create a new row for the pause/resume button
    const pauseRow = document.createElement('div');
    pauseRow.className = 'stat';
    // Empty label to align with existing stats rows
    const labelSpan = document.createElement('span');
    labelSpan.textContent = '';
    pauseRow.appendChild(labelSpan);
    // Create the button
    const btn = document.createElement('button');
    btn.id = 'btnPause';
    btn.className = 'btn btn-ghost';
    btn.textContent = 'Pause';
    pauseRow.appendChild(btn);
    // Append the row to the stats panel
    statsPanel.appendChild(pauseRow);

    // Attach click handler
    btn.addEventListener('click', () => {
      // If the management overlay is open, ignore toggle
      if (window.GameState && window.GameState.mgmtOpen) return;
      // Toggle the paused state
      if (window.GameState) {
        window.GameState.paused = !window.GameState.paused;
        btn.textContent = window.GameState.paused ? 'Continuer' : 'Pause';
      }
    });
  }
})();