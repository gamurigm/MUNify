# 📊 Visualización de Datos Geopolíticos y Estadísticos

Para que los documentos generado por la IA no solo contengan texto, sino también evidencia visual impactante, utilizaremos las tecnologías más modernas compatibles con **React 19** y **Next.js 15**.

---

## 1. Gráficos Estadísticos: **Tremor** (basado en Recharts)

Para gráficos de barras, líneas y áreas, la mejor opción actual es **Tremor**.
*   **Por qué:** Está diseñado específicamente para dashboards profesionales. Tiene una estética "limpia" tipo Shadcn/ui incorporada de forma nativa.
*   **Uso en MUNify:** 
    *   Evolución de emisiones de CO2 (para comités de medio ambiente).
    *   Comparativa de presupuestos militares entre países.
    *   Resultados de votaciones en tiempo real (votos a favor vs. en contra).

## 2. Mapas Geopolíticos: **React-simple-maps** (SVG)

En un MUN, los mapas son clave para visualizar bloques regionales.
*   **Por qué:** A diferencia de Leaflet o Google Maps, **React-simple-maps** genera mapas en formato **SVG**. Esto es crucial porque:
    1.  Son extremadamente ligeros.
    2.  Es muy fácil colorear países específicos basándose en sus votos o alianzas.
    3.  Se ven perfectos al exportar a **PDF** o **DOCX**.
*   **Uso en MUNify:**
    *   Mapa de alianzas estratégicas (colorear miembros de la OTAN, ALBA, UE, etc.).
    *   Distribución de ayuda humanitaria en una zona de crisis.

## 3. Tablas de Datos: **TanStack Table v8** (específicamente Shadcn Data Tables)

Para manejar listas de países, tratados o miembros de comités.
*   **Por qué:** Es el estándar de oro para tablas complejas. Soporta filtrado, ordenamiento por columnas y paginación ultra-rápida.
*   **Uso en MUNify:**
    *   Listado exhaustivo de tratados ratificados por un país.
    *   Ranking de cumplimiento de Objetivos de Desarrollo Sostenible (ODS).

---

## 4. Estrategia de Exportación para Documentos Finales

Un desafío técnico es que los gráficos de la web lleguen bien al documento Word (.docx) o PDF.

*   **Exportación a PDF:** Usaremos **React-PDF**. Esta librería permite renderizar componentes de React directamente en archivos PDF con calidad de impresión.
*   **Exportación a Word:** Usaremos **Docx.js**. Convertiremos los SVGs de nuestros mapas y gráficos en imágenes PNG de alta resolución antes de insertarlos en el documento oficial.

---

## 5. Ejemplo de Componente de Mapa
Para visualizar la votación de una resolución:

```tsx
import { ComposableMap, Geographies, Geography } from "react-simple-maps"

const MapChart = ({ voteData }) => {
  return (
    <ComposableMap>
      <Geographies geography="/world-countries.json">
        {({ geographies }) =>
          geographies.map((geo) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill={voteData[geo.properties.name] === 'YES' ? "#10b981" : "#ef4444"}
            />
          ))
        }
      </Geographies>
    </ComposableMap>
  )
}
```
