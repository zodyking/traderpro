<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    type?: string
    placeholder?: string
    error?: string
    disabled?: boolean
    id?: string
  }>(),
  {
    modelValue: '',
    label: undefined,
    type: 'text',
    placeholder: undefined,
    error: undefined,
    disabled: false,
    id: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputId = computed(() => props.id ?? `input-${useId()}`)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      v-if="label"
      :for="inputId"
      class="text-xs font-medium text-text-secondary"
    >
      {{ label }}
    </label>
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${inputId}-error` : undefined"
      class="h-9 w-full rounded-md border bg-bg-raised px-3 font-mono text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
      :class="
        error
          ? 'border-bear focus:border-bear focus:ring-bear/30'
          : 'border-border-strong hover:border-border-strong/80 focus:border-accent'
      "
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <p
      v-if="error"
      :id="`${inputId}-error`"
      class="text-xs text-bear"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>
