<template>
    <div class="update" >
    </div>
</template>

<script>
import amulets from 'amulets'


export default {
    props: {
        name: {
            type: Number,
            default: 0,
        },
    },
    data: () => ({
        baseURL: 'http://localhost:8081/',
        // baseURL: 'https://spectrum-5aa94.web.app/',
    }),
    methods: {
    },
    mounted() {
        fetch(`${ this.baseURL }update/library.json`)
            .then(response => response.json())
            .then(json => {
                console.log(json)
                amulets.savePrefs(json, {
                    folderName: 'library',
                    fileName: 'library'
                })
            })
            .catch(err => {
                console.log(err)
            })
    },
}   
</script>
