<template>
    <div class="server" >
    </div>
</template>

<script>
import amulets from 'amulets'
export default {
    props: {
        devName: {
            type: String,
            default: 'BattleAxe'
        },
        scriptName: {
            type: String,
            default: 'Timelord'
        },
        port: {
            type: Number,
            default: 4000
        },
    },
    data: () => ({
    }),
    methods: {
    },
    created() {
        amulets.configure({devName: this.devName, scriptName: this.scriptName})
        amulets.newServer(this.port)
        
    },
}
</script>
