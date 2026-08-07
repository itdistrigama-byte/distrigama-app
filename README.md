Aplicacion web para el equipo comercial de Grupo Distrigama 20-22, C.A. Prospeccion, cartera de clientes, plan semanal y levantamiento de pedidos.

La version esta en APP_VERSION dentro de js/config.js. Al desplegar hay que subirla ahi y tambien en Firestore, en config/app campo version: eso enciende el aviso de actualizacion en los telefonos de los vendedores.

El catalogo se administra desde un panel propio en el hosting de la empresa. No editar data-catalog.js a mano: se regenera al publicar desde el panel.
