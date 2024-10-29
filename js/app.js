// Registro del SW y sincronización
if('serviceWorker' in navigator && 'SyncManager' in window){
    navigator.serviceWorker.register('/sw.js') // Registra el Service Worker
    // Al registrarse correctamente, el objeto reg representa la instancia del Service Worker registrado.
    .then((reg) => {
        console.log("Service Worker registrado")

        // Formulario de registro de usuario y solicitud a la API
        document.getElementById('registerBtn').addEventListener('click', () => {
            const name = document.getElementById('name').value;
            const job = document.getElementById('job').value;

            if (name === '' || job === '') {
                alert('Por favor ingrese ambos campos.');
                return;
            }

            fetch('https://reqres.in/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    job: job
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error en la respuesta de la API');
                }
                return response.json();
            })
            .then(data => {
                console.log('Respuesta de la API:', data);
        
                // Mostrar la respuesta en el DOM
                document.getElementById('response').innerHTML = `
                    <p>ID: ${data.id}</p>
                    <p>Nombre: ${data.name}</p>
                    <p>Trabajo: ${data.job}</p>
                    <p>Fecha de creación: ${data.createdAt}</p>
                `;
            })
            .catch(error => {
                console.error('Error en la petición:', error);
        
                // Si falla, guardar en IndexedDB y registrar sincronización
                saveUserDataToIndexedDB(name, job)
                    .then(() => {
                        // Se registra una sincronización en segundo plano (sync-users) para cuando vuelva la conexión
                        reg.sync.register('sync-users').then(() => {
                            console.log('Sincronización registrada cuando vuelva la conexión.');
                        }).catch(err => console.error('Error al registrar la sincronización:', err));                        
                    });
        
                document.getElementById('response').innerHTML = `
                    <p>Error al registrar. Los datos se han guardado localmente en IndexedDB.</p>
                `;
            });
        })

        // Un botón con ID deleteAllBtn permite eliminar todos los usuarios almacenados en IndexedDB
        document.getElementById('deleteAllBtn').addEventListener('click', function () {
            eliminarTodosLosUsuarios();
        });
    })
}

// IndexedDB: Crear base de datos y guardar usuarios
let db = indexedDB.open('database')

db.onupgradeneeded = event => {
    let result = event.target.result;
    // Se crea una base de datos llamada database con un ObjectStore llamado usuarios. Cada registro tiene un campo id autoincremental.
    result.createObjectStore('usuarios',{keyPath:'id', autoIncrement: true});
}

// La función saveUserDataToIndexedDB guarda un nuevo usuario con name y job en IndexedDB. 
// Retorna una promesa que se resuelve al insertar los datos correctamente o se rechaza en caso de error.
function saveUserDataToIndexedDB(name, job) {
    // Se utilizan promesas para que otras partes del código puedan saber cuándo se completó la operación de guardar un usuario en IndexedDB.
    return new Promise((resolve, reject) => {
        let db = indexedDB.open('database');
        
        db.onsuccess = event => {
            let result = event.target.result;
            let transaction = result.transaction('usuarios', 'readwrite');
            let obj = transaction.objectStore('usuarios');
    
            let resultado = obj.add({name, job});
    
            resultado.onsuccess = () => {
                console.log('Datos insertados correctamente en IndexedDB:', { name, job });
                resolve();  // Resuelve la promesa
            }
    
            resultado.onerror = event => {
                console.error('Error al insertar datos:', event);
                reject(event);  // Rechaza la promesa en caso de error
            }
        }

        db.onerror = event => {
            console.error('Error al abrir la base de datos:', event);
            reject(event);
        }
    });
}

// Eliminar todos los usuarios de IndexedDB
function eliminarTodosLosUsuarios() {
    let db = window.indexedDB.open('database')

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