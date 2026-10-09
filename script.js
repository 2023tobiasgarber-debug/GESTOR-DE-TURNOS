
"use strict";

// ========================================
// ELEMENTOS HTML
// ========================================

const formulario = document.getElementById("formularioTurno");
const nombreInput = document.getElementById("nombre");
const fechaInput = document.getElementById("fecha");
const horarioSelect = document.getElementById("horario");
const especialidadSelect = document.getElementById("especialidad");

const mensaje = document.getElementById("mensaje");
const mensajeHorario = document.getElementById("mensajeHorario");
const listaTurnos = document.getElementById("listaTurnos");
const sinTurnos = document.getElementById("sinTurnos");

const cantidadTurnos = document.getElementById("cantidadTurnos");
const cantidadOcupados = document.getElementById("cantidadOcupados");
const cantidadDisponibles = document.getElementById("cantidadDisponibles");

const filtroFecha = document.getElementById("filtroFecha");
const verTodosBtn = document.getElementById("verTodos");

const horaInicioInput = document.getElementById("horaInicio");
const horaFinInput = document.getElementById("horaFin");
const diasAtencionSelect = document.getElementById("diasAtencion");
const guardarConfiguracionBtn =
    document.getElementById("guardarConfiguracion");

// ========================================
// CONFIGURACIÓN DEL CONSULTORIO
// ========================================

const CONFIGURACION_INICIAL = {
    inicio: "08:00",
    fin: "18:00",
    dias: "lunes-viernes"
};

function cargarConfiguracion() {
    try {
        const guardada = localStorage.getItem("configuracionConsultorio");

        if (guardada) {
            const config = JSON.parse(guardada);

            if (
                typeof config.inicio === "string" &&
                typeof config.fin === "string" &&
                ["lunes-viernes", "lunes-sabado", "todos"].includes(config.dias)
            ) {
                return config;
            }
        }
    } catch (error) {
        console.error("No se pudo cargar la configuración:", error);
    }

    return { ...CONFIGURACION_INICIAL };
}

let configuracion = cargarConfiguracion();

// ========================================
// ALMACENAMIENTO DE TURNOS
// ========================================

function cargarTurnos() {
    try {
        const guardados = localStorage.getItem("turnosMedicos");
        const turnos = guardados ? JSON.parse(guardados) : [];

        if (!Array.isArray(turnos)) {
            return [];
        }

        return turnos.filter(turno =>
            turno &&
            typeof turno.id === "string" &&
            typeof turno.nombre === "string" &&
            typeof turno.fecha === "string" &&
            typeof turno.horario === "string" &&
            typeof turno.especialidad === "string"
        );
    } catch (error) {
        console.error("No se pudieron cargar los turnos:", error);
        return [];
    }
}

let turnos = cargarTurnos();

function guardarTurnos() {
    try {
        localStorage.setItem("turnosMedicos", JSON.stringify(turnos));
        return true;
    } catch (error) {
        console.error("No se pudieron guardar los turnos:", error);
        mostrarMensaje(
            "No se pudieron guardar los datos. Revisá el almacenamiento del navegador.",
            "error"
        );
        return false;
    }
}

function guardarConfiguracionEnMemoria(config) {
    try {
        localStorage.setItem(
            "configuracionConsultorio",
            JSON.stringify(config)
        );
        return true;
    } catch (error) {
        console.error("No se pudo guardar la configuración:", error);
        mostrarMensaje("No se pudo guardar la configuración.", "error");
        return false;
    }
}

// ========================================
// FECHAS Y HORARIOS
// ========================================

// Obtiene la fecha local sin errores de zona horaria.
function fechaLocal(date = new Date()) {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

// Valida que una fecha tenga el formato correcto
// y que realmente exista en el calendario.
function fechaValida(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return false;
    }

    const [anio, mes, dia] = fecha.split("-").map(Number);
    const fechaObjeto = new Date(anio, mes - 1, dia);

    return (
        fechaObjeto.getFullYear() === anio &&
        fechaObjeto.getMonth() === mes - 1 &&
        fechaObjeto.getDate() === dia
    );
}

function minutosDesdeMedianoche(hora) {
    if (!/^\d{2}:\d{2}$/.test(hora)) {
        return NaN;
    }

    const [horas, minutos] = hora.split(":").map(Number);

    if (horas > 23 || minutos > 59) {
        return NaN;
    }

    return horas * 60 + minutos;
}

function convertirMinutosAHora(minutos) {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;

    return (
        String(horas).padStart(2, "0") +
        ":" +
        String(resto).padStart(2, "0")
    );
}

function fechaLegible(fecha) {
    if (!fechaValida(fecha)) {
        return fecha;
    }

    const [anio, mes, dia] = fecha.split("-").map(Number);

    return new Date(anio, mes - 1, dia).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function diaDeLaSemana(fecha) {
    const [anio, mes, dia] = fecha.split("-").map(Number);

    return new Date(anio, mes - 1, dia).getDay();
}

function diaHabil(fecha, diasAtencion = configuracion.dias) {
    const dia = diaDeLaSemana(fecha);

    if (diasAtencion === "todos") {
        return true;
    }

    if (diasAtencion === "lunes-sabado") {
        return dia >= 1 && dia <= 6;
    }

    return dia >= 1 && dia <= 5;
}

function esHorarioValido(horario) {
    const inicio = minutosDesdeMedianoche(configuracion.inicio);
    const fin = minutosDesdeMedianoche(configuracion.fin);
    const minutos = minutosDesdeMedianoche(horario);

    return (
        Number.isFinite(inicio) &&
        Number.isFinite(fin) &&
        Number.isFinite(minutos) &&
        fin > inicio &&
        minutos >= inicio &&
        minutos + 30 <= fin &&
        (minutos - inicio) % 30 === 0
    );
}

function turnoEnElPasado(fecha, horario) {
    const fechaHoraTurno = `${fecha}T${horario}:00`;
    const fechaTurno = new Date(fechaHoraTurno);

    return fechaTurno.getTime() <= Date.now();
}

// ========================================
// GENERAR HORARIOS CADA 30 MINUTOS
// ========================================

function generarHorarios(fecha) {
    horarioSelect.replaceChildren();

    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.textContent = "Seleccioná un horario";

    horarioSelect.appendChild(opcionInicial);

    if (!fecha || !fechaValida(fecha)) {
        opcionInicial.textContent = "Primero seleccioná una fecha";
        horarioSelect.disabled = true;
        mensajeHorario.textContent = "Seleccioná una fecha para ver los horarios.";
        actualizarResumen();
        return;
    }

    if (fecha < fechaLocal()) {
        opcionInicial.textContent = "La fecha ya pasó";
        horarioSelect.disabled = true;
        mensajeHorario.textContent = "No se pueden reservar fechas anteriores a hoy.";
        actualizarResumen();
        return;
    }

    if (!diaHabil(fecha)) {
        opcionInicial.textContent = "Consultorio cerrado";
        horarioSelect.disabled = true;
        mensajeHorario.textContent = "El consultorio no atiende ese día.";
        actualizarResumen();
        return;
    }

    const inicio = minutosDesdeMedianoche(configuracion.inicio);
    const fin = minutosDesdeMedianoche(configuracion.fin);

    if (
        !Number.isFinite(inicio) ||
        !Number.isFinite(fin) ||
        fin <= inicio
    ) {
        opcionInicial.textContent = "Horario no configurado";
        horarioSelect.disabled = true;
        mensajeHorario.textContent = "Revisá la configuración del consultorio.";
        actualizarResumen();
        return;
    }

    let cantidad = 0;

    for (let minutos = inicio; minutos + 30 <= fin; minutos += 30) {
        const hora = convertirMinutosAHora(minutos);

        // No ofrecer turnos que ya pasaron hoy.
        if (fecha === fechaLocal() && turnoEnElPasado(fecha, hora)) {
            continue;
        }

        const ocupado = turnos.some(turno =>
            turno.fecha === fecha && turno.horario === hora
        );

        const opcion = document.createElement("option");
        opcion.value = hora;
        opcion.textContent = ocupado
            ? `${hora} — Ocupado`
            : hora;

        opcion.disabled = ocupado;

        horarioSelect.appendChild(opcion);
        cantidad++;
    }

    horarioSelect.disabled = cantidad === 0;

    if (cantidad === 0) {
        opcionInicial.textContent = "No hay horarios disponibles";
        mensajeHorario.textContent =
            "Probá con otra fecha o revisá el horario del consultorio.";
    } else {
        mensajeHorario.textContent =
            "Los turnos duran 30 minutos. Los horarios ocupados no se pueden seleccionar.";
    }

    actualizarResumen();
}

// ========================================
// MENSAJES
// ========================================

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = tipo;
}

// ========================================
// REGISTRAR UN TURNO
// ========================================

formulario.addEventListener("submit", function (evento) {
    evento.preventDefault();

    const nombre = nombreInput.value.trim().replace(/\s+/g, " ");
    const fecha = fechaInput.value;
    const horario = horarioSelect.value;
    const especialidad = especialidadSelect.value;

    if (!nombre || !fecha || !horario || !especialidad) {
        mostrarMensaje("Completá todos los campos obligatorios.", "error");
        return;
    }

    if (!fechaValida(fecha) || fecha < fechaLocal()) {
        mostrarMensaje("Elegí una fecha válida desde hoy en adelante.", "error");
        return;
    }

    if (!diaHabil(fecha)) {
        mostrarMensaje("El consultorio está cerrado ese día.", "error");
        return;
    }

    if (!esHorarioValido(horario)) {
        mostrarMensaje("El horario seleccionado no es válido.", "error");
        generarHorarios(fecha);
        return;
    }

    if (turnoEnElPasado(fecha, horario)) {
        mostrarMensaje("No podés reservar un horario que ya pasó.", "error");
        generarHorarios(fecha);
        return;
    }

    // La combinación de fecha y horario debe ser única.
    const existe = turnos.some(turno =>
        turno.fecha === fecha && turno.horario === horario
    );

    if (existe) {
        mostrarMensaje("Ese horario ya está ocupado. Elegí otro.", "error");
        generarHorarios(fecha);
        return;
    }

    const nuevoTurno = {
        id: crearId(),
        nombre: nombre,
        fecha: fecha,
        horario: horario,
        especialidad: especialidad
    };

    turnos.push(nuevoTurno);

    if (!guardarTurnos()) {
        turnos.pop();
        return;
    }

    formulario.reset();

    filtroFecha.value = fecha;
    filtroFecha.dataset.activo = "true";

    fechaInput.value = fecha;
    generarHorarios(fecha);
    mostrarTurnos();
    mostrarMensaje("¡Turno asignado correctamente!", "exito");
});

function crearId() {
    if (typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return "turno-" + Date.now() + "-" +
        Math.random().toString(36).slice(2);
}

// ========================================
// ELIMINAR UN TURNO
// ========================================

function eliminarTurno(id) {
    const turno = turnos.find(item => item.id === id);

    if (!turno) {
        mostrarMensaje("No se encontró el turno seleccionado.", "error");
        return;
    }

    const confirmar = window.confirm(
        `¿Querés eliminar el turno de ${turno.nombre} del ` +
        `${fechaLegible(turno.fecha)} a las ${turno.horario}?`
    );

    if (!confirmar) {
        return;
    }

    const anteriores = [...turnos];
    turnos = turnos.filter(item => item.id !== id);

    if (!guardarTurnos()) {
        turnos = anteriores;
        return;
    }

    generarHorarios(fechaInput.value);
    mostrarTurnos();
    mostrarMensaje("Turno eliminado. El horario quedó disponible.", "exito");
}

// ========================================
// MOSTRAR LOS TURNOS
// ========================================

function mostrarTurnos() {
    listaTurnos.replaceChildren();

    let turnosVisibles = [...turnos];

    if (filtroFecha.value) {
        turnosVisibles = turnosVisibles.filter(turno =>
            turno.fecha === filtroFecha.value
        );
    }

    // Orden cronológico.
    turnosVisibles.sort((a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.horario.localeCompare(b.horario)
    );

    sinTurnos.hidden = turnosVisibles.length > 0;

    if (turnosVisibles.length === 0) {
        sinTurnos.textContent = filtroFecha.value
            ? "No hay turnos registrados para esa fecha."
            : "Todavía no hay turnos registrados.";
    }

    turnosVisibles.forEach(turno => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta-turno";

        const datos = document.createElement("div");
        datos.className = "datos-turno";

        const nombre = document.createElement("h3");
        nombre.textContent = turno.nombre;

        const horario = document.createElement("span");
        horario.className = "hora-turno";
        horario.textContent = turno.horario;

        const fecha = document.createElement("p");
        fecha.textContent = "Fecha: " + fechaLegible(turno.fecha);

        const especialidad = document.createElement("p");
        especialidad.textContent = "Especialidad: " + turno.especialidad;

        const estado = document.createElement("span");
        estado.className = "etiqueta-ocupado";
        estado.textContent = "OCUPADO";

        const botonEliminar = document.createElement("button");
        botonEliminar.type = "button";
        botonEliminar.className = "boton-eliminar";
        botonEliminar.textContent = "Eliminar";
        botonEliminar.setAttribute(
            "aria-label",
            `Eliminar turno de ${turno.nombre}, ${turno.fecha} a las ${turno.horario}`
        );

        botonEliminar.addEventListener("click", () => {
            eliminarTurno(turno.id);
        });

        datos.append(nombre, horario, fecha, especialidad, estado);
        tarjeta.append(datos, botonEliminar);
        listaTurnos.appendChild(tarjeta);
    });

    actualizarResumen();
}

// ========================================
// CONTADORES DE TURNOS
// ========================================

function actualizarResumen() {
    cantidadTurnos.textContent = turnos.length;

    // El resumen corresponde a la fecha del filtro,
    // o a la fecha elegida en el formulario.
    const fechaResumen =
        filtroFecha.value || fechaInput.value || fechaLocal();

    const turnosDeLaFecha = turnos.filter(turno =>
        turno.fecha === fechaResumen
    );

    cantidadOcupados.textContent = turnosDeLaFecha.length;

    let disponibles = 0;

    if (
        fechaValida(fechaResumen) &&
        fechaResumen >= fechaLocal() &&
        diaHabil(fechaResumen)
    ) {
        const inicio = minutosDesdeMedianoche(configuracion.inicio);
        const fin = minutosDesdeMedianoche(configuracion.fin);

        if (Number.isFinite(inicio) && Number.isFinite(fin) && fin > inicio) {
            for (
                let minutos = inicio;
                minutos + 30 <= fin;
                minutos += 30
            ) {
                const hora = convertirMinutosAHora(minutos);

                if (
                    fechaResumen === fechaLocal() &&
                    turnoEnElPasado(fechaResumen, hora)
                ) {
                    continue;
                }

                const ocupado = turnosDeLaFecha.some(turno =>
                    turno.horario === hora
                );

                if (!ocupado) {
                    disponibles++;
                }
            }
        }
    }

    cantidadDisponibles.textContent = disponibles;
}

// ========================================
// CAMBIAR FECHA Y FILTRAR
// ========================================

fechaInput.min = fechaLocal();
filtroFecha.min = fechaLocal();
filtroFecha.value = fechaLocal();

fechaInput.addEventListener("change", function () {
    mostrarMensaje("", "");
    generarHorarios(fechaInput.value);
});

filtroFecha.addEventListener("change", function () {
    if (filtroFecha.value && !fechaValida(filtroFecha.value)) {
        filtroFecha.value = fechaLocal();
    }

    filtroFecha.dataset.activo = "true";
    mostrarTurnos();
});

verTodosBtn.addEventListener("click", function () {
    filtroFecha.value = "";
    delete filtroFecha.dataset.activo;
    mostrarTurnos();
});

// ========================================
// CONFIGURAR EL CONSULTORIO
// ========================================

function mostrarConfiguracion() {
    horaInicioInput.value = configuracion.inicio;
    horaFinInput.value = configuracion.fin;
    diasAtencionSelect.value = configuracion.dias;
}

guardarConfiguracionBtn.addEventListener("click", function () {
    const inicio = horaInicioInput.value;
    const fin = horaFinInput.value;
    const dias = diasAtencionSelect.value;

    const minutosInicio = minutosDesdeMedianoche(inicio);
    const minutosFin = minutosDesdeMedianoche(fin);

    if (
        !Number.isFinite(minutosInicio) ||
        !Number.isFinite(minutosFin) ||
        minutosFin <= minutosInicio
    ) {
        mostrarMensaje(
            "La hora de cierre debe ser posterior a la de apertura.",
            "error"
        );
        return;
    }

    if (!["lunes-viernes", "lunes-sabado", "todos"].includes(dias)) {
        mostrarMensaje("Seleccioná días de atención válidos.", "error");
        return;
    }

    // No permitir una configuración que invalide turnos existentes.
    const configuracionAnterior = configuracion;

    const nuevaConfiguracion = { inicio, fin, dias };

    const turnosInvalidos = turnos.some(turno => {
        const minuto = minutosDesdeMedianoche(turno.horario);

        return (
            !fechaValida(turno.fecha) ||
            !diaHabil(turno.fecha, dias) ||
            !Number.isFinite(minuto) ||
            minuto < minutosInicio ||
            minuto + 30 > minutosFin ||
            (minuto - minutosInicio) % 30 !== 0
        );
    });

    if (turnosInvalidos) {
        mostrarMensaje(
            "No se puede aplicar esta configuración porque dejaría turnos existentes fuera del horario de atención. Eliminá o reprogramá esos turnos primero.",
            "error"
        );
        return;
    }

    configuracion = nuevaConfiguracion;

    if (!guardarConfiguracionEnMemoria(configuracion)) {
        configuracion = configuracionAnterior;
        return;
    }

    fechaInput.min = fechaLocal();
    filtroFecha.min = fechaLocal();

    generarHorarios(fechaInput.value);
    mostrarTurnos();

    mostrarMensaje("Configuración guardada correctamente.", "exito");
});

// ========================================
// INICIAR APLICACIÓN
// ========================================

mostrarConfiguracion();
generarHorarios(fechaLocal());
mostrarTurnos();