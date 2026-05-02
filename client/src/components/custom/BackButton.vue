<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { getParentPath } from "@/lib/utils";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const parentPath = computed(() => getParentPath(route.path));

const goBack = () => {
  if (window.history.state?.back) {
    router.back();
  } else {
    router.push(parentPath.value);
  }
};
</script>

<template>
  <Button variant="outline" class="absolute m-2" @click="goBack"> Back </Button>
</template>
