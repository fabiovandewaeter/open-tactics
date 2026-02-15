<script lang="ts">
  import Board from "./components/Board.svelte";
  import IsoBoard from "./components/IsoBoard.svelte";
</script>

<main>
  <h1>Tactical Board — Prototype</h1>
  <IsoBoard />
  <Board />
</main>

<style>
  main {
    padding: 12px;
    font-family: system-ui, Arial, sans-serif;
  }
  h1 {
    margin: 0 0 12px 0;
  }
</style>
