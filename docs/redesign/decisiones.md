# Rediseño de solax-monitor: decisiones

Notas para el caso de portafolio de Beto y Mohana. Primer pase: pantalla Home.

## El problema

La app mostraba casi todos los datos, pero no respondía lo que importa: ¿la
instalación está rindiendo lo que debería? Todo pesaba igual, y el hallazgo
central del proyecto, que el calor hace bajar la potencia, quedaba en una fila
al final de una tarjeta, separado de la temperatura por una pestaña.

## Decisiones

| Decisión | Por qué |
|---|---|
| Una frase de estado arriba de todo | Responde "¿va todo bien?" sin leer números. Sigue un orden: falla, sin señal, dormido, conectando, calor, límite y, solo al final, normal. |
| Tres cifras clave: ahora, hoy y temperatura | La temperatura sube al primer nivel porque explica la potencia. |
| Temperatura como segundo gráfico por defecto | Potencia y calor se leen juntos, en dos gráficos con el mismo eje de tiempo y no en uno con dos escalas, que inventaría correlaciones. |
| Franjas de sobrecalentamiento en ambos gráficos | Causa y efecto quedan alineados a lo largo de la página. |
| Una sola línea de potencia al abrir | Solar y red casi coinciden; dos líneas se veían como vibración. La de red sigue disponible en la leyenda. |
| Cuadro al pasar el cursor, en lugar de tres leyendas | Muestra hora, valores y estado en ambos gráficos a la vez. |
| Cada color significa una sola cosa | Amarillo solar, turquesa red, naranja calor, rojo falla, verde bien. Los picos y el tiempo al límite pasan a neutros. |
| Lecturas de detalle a un lado; datos del dispositivo plegados | Siguen disponibles sin competir con lo principal. |
| Sin marcas de 85 °C ni 2.4 kW en los indicadores | La app no recibe esos valores. Agregarlos fijos sería inventar un dato que depende de cada instalación. |

## Modos temáticos

Además de claro y oscuro habrá modos donde manda la estética, para mostrar un
mismo producto con varios lenguajes tipográficos: Terminal con números en
ASCII, fósforo retro y panel táctico. Son estéticas propias, no copias de
obras existentes. Van integrados con un selector, y las alertas siempre se
leen. El orden es: cerrar la UX, preparar la base y el modo claro, hacer
Terminal, mostrárselo a Mohana y luego los otros dos.

### Primer tema: Command (2026-11-24, prueba)

Beto pidió adelantar los temas mientras diseña a detalle la interfaz final;
los temas conviven con ella y no la sustituyen. Command parte del lenguaje de
los paneles tácticos del anime, con diseño propio: sin nombres, logos, textos
ni pantallas de ninguna obra.

Nota de Beto que lo define: las interfaces de referencia salen cuando algo va
mal, así que aquí se diseña también **la versión en calma**.

- En calma: estructura ámbar, cifras verdes, nada de rojo.
- Límite y sin señal: amarillo. Sin producción: todo se atenúa.
- Calor y falla: rojo, franjas de peligro y rótulo grande. Solo la falla late,
  y se detiene si el sistema pide reducir movimiento.
- Instrumentos propios: potencia en segmentos, banco de 60 celdas solares (cada
  una, 1/60 del límite), columna de 0 a 100 °C sin marca de peligro inventada y
  una onda de red ilustrativa.
- Sin fuentes nuevas: usa Helvetica Neue condensada de macOS; en otros sistemas
  cae en Arial Narrow o similar y pierde carácter. Falta elegir una incluida.

### Siete temas (2026-11-24)

Pedidos por Beto a partir de su carpeta de referencias. Nombres provisionales.
Son estéticas propias: se toma el género, no las pantallas de cada obra.

| Tema | Referencia | Instrumento propio |
|---|---|---|
| Command | Evangelion | Segmentos, celdas, columna y onda |
| Bureau | Severance | Libro de las últimas 72 lecturas reales; sin la cuadrícula de números flotantes ni el globo |
| Bridge | Star Trek TNG | 16 lámparas; bloques redondeados con paleta propia, sin los marcos en codo |
| Phosphor | Fallout | Aguja sobre pantalla de osciloscopio; sin carcasa, pestañas ni mascota |
| Daylight | Simple | Arco de marcas y cielo que cambia con la hora de la lectura |
| Spectrum | Moderno | Campos de color y puntos por media hora |
| Soft | Skewmorphism | Anillo de luz moldeado que cambia con el estado |

Todos comparten estructura y datos: cuando Beto entregue el layout final se
cambia una vez y luego se afina cada tema. Las fuentes son del sistema (macOS);
faltan las incluidas. Month y Year solo heredan colores y letras.

## Datos usados

Un día real de Mohana, reproducido solo en local. Es privado y no se versiona. Los días anteriores, Month y Year siguen
simulados, así que los estados de sobrecalentamiento se probaron con días
simulados.

## Pendiente

- Tipografía nueva, a elegir por Beto.
- Month y Year: solo heredaron colores; falta rediseñarlos.
- En teléfono, la frase y las cifras ocupan toda la primera pantalla y el gráfico queda abajo.
- Validar con días reales de sobrecalentamiento cuando Mohana los comparta.
