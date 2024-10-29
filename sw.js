const APP_SHELL_CACHE = 'appShell'; //Nombre de la caché principal
const DYNAMIC_CACHE = 'dynamic'; // Nombre de la caché dinamica
// Array de las rutas de los archivos esenciales
const APP_SHELL = [
    '/',
    '/index.html',
    '/public/img/doctores.png',
    '/public/img/error.png',
    '/js/app.js' ];

// Instalación del Service Worker y cacheo de archivos principales (app shell)
self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(APP_SHELL_CACHE).then((cache) => {
        console.log('Caching app shell');
        return cache.addAll(APP_SHELL);
      })
    );
});

// Activación del SW y limpieza de cachés
self.addEventListener('activate', (event) => {
    event.waitUntil(
        // Obtiene los nombres de las cachés almacenadas
        caches.keys().then((keys) =>
            Promise.all(
            keys
                .filter((key) => key !== APP_SHELL_CACHE && key !== DYNAMIC_CACHE)
                .map((key) => caches.delete(key)) // Borra los cachpes que no sean los actuales
            )
        )
    );
});

// Intercepta peticiones de red
self.addEventListener('fetch', event => {
    const resp = fetch(event.request).then(respuesta => {
        if (!respuesta) {
            // Si la respuesta no existe, buscamos en el cache
            return caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                } else {
                    // Si no está en el cache, retornamos una imagen de error desde el cache
                    return caches.match('/public/img/error.png');
                }
            });
        } else {
            // Si la respuesta existe, la almacenamos en el cache dinámico
            return caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(event.request.url, respuesta.clone());
                return respuesta;
            });
        }
    }).catch(err => {
        // Si ocurre un error (por ejemplo, si no hay conexión), buscamos en el cache
        return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            } else {
                // Si no está en el cache, retornamos la imagen de error
                return caches.match('/public/img/error.png');
            }
        });
    });

    event.respondWith(resp);
});

// Sincronización en segundo plano
self.addEventListener('sync', event => {
    console.log('Sync event triggered', event);
    // Si el tag del evento es 'sync-users', se llama a la función sendUserDataFromIndexedDB(), 
    //que intenta sincronizar los datos de usuarios almacenados en IndexedDB con un servidor remoto.
    if (event.tag === 'sync-users') {
        event.waitUntil(sendUserDataFromIndexedDB());
    }
});

// Función para sincronizar datos de IndexedDB
function sendUserDataFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const dbRequest = indexedDB.open('database');

        dbRequest.onsuccess = event => {
            const db = event.target.result;
            const transaction = db.transaction('usuarios', 'readonly');
            const objectStore = transaction.objectStore('usuarios');
            const getAllRequest = objectStore.getAll();

            getAllRequest.onsuccess = () => {
                const users = getAllRequest.result;

                if (users.length === 0) {
                    console.log('No hay usuarios para sincronizar.');
                    return resolve();
                }

                // Realizar fetch por cada usuario
                const promises = users.map(user => {
                    return fetch('https://reqres.in/api/users', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(user)
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Error en la API');
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('Datos sincronizados con éxito:', data);
                        
                        // Si la sincronización es exitosa, se llama a eliminarTodosLosUsuarios() para limpiar la base de datos local.
                        eliminarTodosLosUsuarios()
                    })
                    .catch(error => {
                        console.error('Error al sincronizar usuario:', error);
                    });
                });

                // Esperar a que todas las solicitudes terminen
                Promise.all(promises).then(() => resolve()).catch(reject);
            };

            getAllRequest.onerror = event => {
                console.error('Error al obtener usuarios de IndexedDB:', event);
                reject();
            };
        };

        dbRequest.onerror = event => {
            console.error('Error al abrir la base de datos:', event);
            reject();
        };
    });
}

// Función para eliminar usuarios de IndexedDB
function eliminarTodosLosUsuarios() {
    let db = indexedDB.open('database')

    db.onsuccess = event => {
        let result = event.target.result;

        let transaccion = result.transaction('usuarios', 'readwrite');
        let obj = transaccion.objectStore('usuarios');
        
        // Obtenemos todos los registros de la base de datos
        let cursorRequest = obj.openCursor();

        cursorRequest.onsuccess = event => {
            let cursor = event.target.result;

            if (cursor) {
                // Mostramos el registro en la consola
                console.log('Usuario encontrado:', cursor.value);
    
                // Eliminamos el registro actual
                let deleteRequest = cursor.delete();
    
                deleteRequest.onsuccess = () => {
                    console.log(`Usuario con ID ${cursor.value.id} eliminado`);
                };
    
                // Continuamos con el siguiente registro
                cursor.continue();
            } else {
                // No quedan más registros
                console.log('No hay más usuarios por eliminar.');
            }
        }

        cursorRequest.onerror = event => {
            console.error('Error al abrir el cursor:', event);
        };
    }
}
