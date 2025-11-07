<script setup lang="ts">
import InterfaceFragment from '../components/InterfaceFragment.vue'
import { controlViewState, globalState, localState } from '../states/config'
</script>

<template>
  <interface-fragment></interface-fragment>
  <div>
    {{ globalState }}
  </div>
  <div>
    {{ localState }}
  </div>
  <div>
    {{ controlViewState }}
  </div>
</template>
