<script lang="ts">

    interface Props {
      size?: 'sm' | 'md' | 'lg';  // can be sm or md
    }
  
    let {
      size = 'md',  // can be sm or md
    }: Props = $props();
  
  </script> 
  
  <div
    class={[
        'border-blue-200 border-y-blue-500 border-r-blue-500 rounded-full animate-spin',
        size === 'sm' && 'w-6 h-6 border-2',
        size === 'md' && 'w-12 h-12 border-4',
        size === 'lg' && 'w-20 h-20 border-8'
    ]}
  ></div>
  
  
  <style>
  
  </style>