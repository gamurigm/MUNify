# pyre-ignore-all-errors
import os
# pyre-ignore[21]
import networkx as nx
# pyre-ignore[21]
from pyvis.network import Network

def generate_interactive_map():
    """Genera un mapa de nodos estilo cyber-neural con PyVis."""
    print("Generando mapa de nodos interactivo con PyVis (Cyber Neural)...")
    
    G = nx.Graph()

    # === NODOS: Países con metadata visual ===
    countries = [
        ("NOR", "🇳🇴 NORUEGA",       1, 45, "#00e5ff"),
        ("SWE", "🇸🇪 SUECIA",        1, 30, "#00bcd4"),
        ("FIN", "🇫🇮 FINLANDIA",     1, 28, "#00acc1"),
        ("DNK", "🇩🇰 DINAMARCA",     1, 28, "#0097a7"),
        ("ISL", "🇮🇸 ISLANDIA",      1, 22, "#00838f"),
        ("USA", "🇺🇸 ESTADOS UNIDOS", 2, 50, "#ff4081"),
        ("GBR", "🇬🇧 REINO UNIDO",   2, 40, "#f50057"),
        ("RUS", "🇷🇺 RUSIA",         3, 48, "#ff3d00"),
        ("CHN", "🇨🇳 CHINA",         3, 42, "#dd2c00"),
        ("FRA", "🇫🇷 FRANCIA",       4, 35, "#7c4dff"),
        ("DEU", "🇩🇪 ALEMANIA",      4, 38, "#651fff"),
        ("JPN", "🇯🇵 JAPÓN",         2, 32, "#e040fb"),
        ("BRA", "🇧🇷 BRASIL",        5, 28, "#76ff03"),
        ("ZAF", "🇿🇦 SUDÁFRICA",     6, 22, "#ffd600"),
        ("IND", "🇮🇳 INDIA",         5, 35, "#ff6d00"),
        ("AUS", "🇦🇺 AUSTRALIA",     2, 26, "#ff80ab"),
        ("CAN", "🇨🇦 CANADÁ",        2, 30, "#ea80fc"),
        ("MEX", "🇲🇽 MÉXICO",        5, 25, "#b2ff59"),
        ("EGY", "🇪🇬 EGIPTO",        6, 20, "#ffab00"),
        ("KOR", "🇰🇷 COREA DEL SUR", 2, 28, "#ff4081"),
    ]

    for nid, label, group, size, color in countries:
        G.add_node(
            nid,
            label=label,
            group=group,
            size=size,
            color={
                "background": color,
                "border": "#ffffff",
                "highlight": {"background": "#ffffff", "border": color},
                "hover": {"background": "#ffffff", "border": color},
            },
            font={"size": 14, "color": "#ffffff", "face": "Courier New", "strokeWidth": 3, "strokeColor": "#000000"},
            title=f"<div style='font-family:monospace;background:#111;color:{color};padding:12px;border-radius:8px;border:1px solid {color};min-width:180px'>"
                  f"<b style='font-size:16px'>{label}</b><br/>"
                  f"<hr style='border-color:{color}40'/>"
                  f"<b>Bloque:</b> {group}<br/>"
                  f"<b>Poder:</b> {'█' * (size // 5)}<br/>"
                  f"<b>Índice:</b> {size}</div>",
            shape="dot",
            borderWidth=2,
            shadow={"enabled": True, "color": color, "size": 15, "x": 0, "y": 0},
        )

    # === ARISTAS: Relaciones ===
    relations = [
        # Nórdicos
        ("NOR", "SWE", "Alianza Nórdica",        "#00e5ff", 4),
        ("NOR", "FIN", "Alianza Nórdica",        "#00e5ff", 3),
        ("NOR", "DNK", "Alianza Nórdica",        "#00e5ff", 3),
        ("NOR", "ISL", "Alianza Nórdica",        "#00e5ff", 2),
        ("SWE", "FIN", "Alianza Nórdica",        "#00bcd4", 3),
        ("SWE", "DNK", "Alianza Nórdica",        "#00bcd4", 2),
        # NATO / Occidental
        ("NOR", "USA", "NATO / Aliado",           "#0088ff", 5),
        ("NOR", "GBR", "NATO / Aliado",           "#0088ff", 4),
        ("USA", "GBR", "Alianza Especial",        "#ff4081", 5),
        ("USA", "CAN", "USMCA / Aliado",          "#ea80fc", 4),
        ("USA", "JPN", "Alianza Pacífico",        "#ff4081", 4),
        ("USA", "KOR", "Alianza Pacífico",        "#ff4081", 3),
        ("USA", "AUS", "AUKUS",                   "#ff80ab", 4),
        ("GBR", "AUS", "AUKUS",                   "#ff80ab", 3),
        ("GBR", "CAN", "Commonwealth",            "#ea80fc", 3),
        ("FRA", "DEU", "Eje Europeo",             "#7c4dff", 5),
        ("NOR", "DEU", "Socio Comercial",         "#aaaaaa", 2),
        ("NOR", "FRA", "Socio Comercial",         "#aaaaaa", 2),
        # Tensiones
        ("USA", "RUS", "⚡ TENSIÓN",              "#ff0000", 2),
        ("USA", "CHN", "⚡ TENSIÓN",              "#ff0000", 3),
        ("NOR", "RUS", "⚡ Frontera Ártica",      "#ffaa00", 2),
        # Bloque Oriental
        ("RUS", "CHN", "Acuerdo Estratégico",     "#ff6e40", 4),
        ("CHN", "IND", "Rivalidad / Comercio",    "#ffab00", 2),
        # Emergentes
        ("BRA", "MEX", "Cooperación LATAM",       "#76ff03", 2),
        ("NOR", "BRA", "Comercio Energético",     "#aaaaaa", 1),
        ("IND", "JPN", "Cooperación Tecnológica", "#ff6d00", 2),
        ("ZAF", "EGY", "Unión Africana",          "#ffd600", 2),
        ("NOR", "ZAF", "Cooperación ONU",         "#aaaaaa", 1),
    ]

    for src, tgt, label, color, weight in relations:
        is_tension = "TENSIÓN" in label or "Rivalidad" in label
        G.add_edge(
            src, tgt,
            title=f"<div style='font-family:monospace;background:#111;color:{color};padding:8px;border-radius:6px;border:1px solid {color}'>{label}</div>",
            label=label,
            color={"color": color + "99", "highlight": color, "hover": color},
            value=weight,
            font={"size": 10, "color": color, "strokeWidth": 0, "align": "middle"},
            dashes=is_tension,
            smooth={"type": "continuous", "roundness": 0.2},
            shadow={"enabled": True, "color": color + "40", "size": 5},
        )

    # === RENDERIZADO PyVis ===
    net = Network(
        height="100%",
        width="100%",
        bgcolor="#0a0a0f",
        font_color="#ffffff",
        directed=False,
    )
    net.from_nx(G)

    # Física tipo neural: nodos se comportan como neuronas biológicas
    net.set_options("""
    {
      "nodes": {
        "borderWidth": 2,
        "borderWidthSelected": 4,
        "opacity": 0.95,
        "shadow": {
          "enabled": true,
          "color": "rgba(0,229,255,0.4)",
          "size": 20,
          "x": 0,
          "y": 0
        }
      },
      "edges": {
        "smooth": {
          "enabled": true,
          "type": "continuous",
          "roundness": 0.3
        },
        "font": {
          "size": 10,
          "strokeWidth": 0
        },
        "shadow": {
          "enabled": true,
          "color": "rgba(0,229,255,0.15)",
          "size": 3
        }
      },
      "physics": {
        "forceAtlas2Based": {
          "gravitationalConstant": -120,
          "centralGravity": 0.008,
          "springLength": 180,
          "springConstant": 0.06,
          "damping": 0.6,
          "avoidOverlap": 0.5
        },
        "maxVelocity": 40,
        "minVelocity": 0.5,
        "solver": "forceAtlas2Based",
        "timestep": 0.4,
        "stabilization": {
          "enabled": true,
          "iterations": 200,
          "updateInterval": 25
        }
      },
      "interaction": {
        "hover": true,
        "tooltipDelay": 100,
        "hideEdgesOnDrag": false,
        "hideEdgesOnZoom": false,
        "navigationButtons": false,
        "keyboard": {
          "enabled": true
        }
      }
    }
    """)

    out_file = os.path.join(os.path.dirname(__file__), "intelmap_noruega.html")
    net.save_graph(out_file)
    
    # Post-procesar el HTML para inyectar estilos cyber premium
    with open(out_file, "r", encoding="utf-8") as f:
        html = f.read()
    
    # Inyectar CSS cyber-neural y quitar márgenes
    cyber_css = """
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        background: #0a0a0f !important; 
        overflow: hidden !important;
        font-family: 'Courier New', monospace;
      }
      #mynetwork {
        width: 100vw !important; 
        height: 100vh !important;
        border: none !important;
        background: radial-gradient(ellipse at center, #0d1117 0%, #0a0a0f 70%, #000005 100%) !important;
      }
      /* Scanline effect */
      body::after {
        content: '';
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 229, 255, 0.015) 2px,
          rgba(0, 229, 255, 0.015) 4px
        );
        pointer-events: none;
        z-index: 9999;
      }
      /* Glow pulse on canvas */
      canvas {
        filter: contrast(1.05) brightness(1.02);
      }
      .vis-tooltip {
        border-radius: 8px !important;
        border: none !important;
        background: transparent !important;
        padding: 0 !important;
        box-shadow: 0 0 20px rgba(0,229,255,0.3) !important;
      }
    </style>
    """
    html = html.replace("<head>", f"<head>{cyber_css}")
    
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(html)
    
    print(f"[OK] Mapa cyber-neural generado: {out_file}")
    return out_file

if __name__ == "__main__":
    generate_interactive_map()
