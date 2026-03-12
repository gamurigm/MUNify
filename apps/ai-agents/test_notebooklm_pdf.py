# pyre-ignore-all-errors
"""
Test REAL de NotebookLM con documentos PDF de MUN.
Requisito: haber ejecutado 'notebooklm login' previamente.
"""
import asyncio
import os
import sys
from pathlib import Path

# Fix encoding for Windows terminals
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Ensure imports work from any cwd
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from notebook_service import NotebookLMService
import logfire

logfire.configure(send_to_logfire=False)

# Directorio raiz del proyecto
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# PDFs reales del proyecto MUN
AVAILABLE_PDFS = [
    PROJECT_ROOT / "MODEL UNITED NATIONS SIMULATION - RULES OF PROCEDURE.pdf",
    PROJECT_ROOT / "mun-doc" / "POs" / "Posicion Oficial Republica Italiana.pdf",
    PROJECT_ROOT / "mun-doc" / "POs" / "PO_India.pdf",
]

async def test_notebooklm_with_pdfs():
    service = NotebookLMService()

    print("=" * 60)
    print("  TEST REAL: NotebookLM con PDFs de MUN")
    print("=" * 60)

    # 1. Verificar credenciales
    if not os.path.exists(service.storage_path):
        print(f"\n[ERROR] No se encontro sesion en {service.storage_path}")
        print("   Ejecuta: .\\apps\\ai-agents\\venv\\Scripts\\notebooklm login")
        return

    print(f"\n[OK] Sesion encontrada: {service.storage_path}")

    # 2. Buscar PDFs disponibles
    pdfs_found = [str(p) for p in AVAILABLE_PDFS if p.exists()]

    if not pdfs_found:
        # Fallback: buscar cualquier PDF en el proyecto
        print("\n[AVISO] PDFs predefinidos no encontrados, buscando otros...")
        for root, dirs, files in os.walk(str(PROJECT_ROOT)):
            # Skip venv and node_modules
            dirs[:] = [d for d in dirs if d not in ("venv", "node_modules", ".git", "__pycache__")]
            for f in files:
                if f.lower().endswith(".pdf"):
                    pdfs_found.append(os.path.join(root, f))
                    if len(pdfs_found) >= 2:
                        break
            if len(pdfs_found) >= 2:
                break

    if not pdfs_found:
        print("\n[ERROR] No se encontraron PDFs de prueba en el proyecto.")
        return

    print(f"\nPDFs encontrados ({len(pdfs_found)}):")
    for pdf in pdfs_found:
        print(f"   - {os.path.basename(pdf)}")

    try:
        # 3. Crear notebook e ingestar PDFs
        print(f"\n--- PASO 1: Creando notebook e ingiriendo {len(pdfs_found)} PDF(s) ---")
        nb_id = await service.ingest_professional_context(
            "MUNify Test - Documentos MUN",
            pdfs_found
        )
        print(f"[OK] Notebook creado/usado con ID: {nb_id}")

        # 4. Consultar el notebook
        print("\n--- PASO 2: Consultando el notebook ---")
        
        query1 = "Cuales son las reglas principales del procedimiento parlamentario en el Modelo de Naciones Unidas?"
        print(f"\n[Pregunta 1]: {query1}")
        answer1 = await service.query_notebook(nb_id, query1)
        print(f"[Respuesta]: {answer1[:500]}...")

        query2 = "Cual es la posicion de los paises mencionados sobre los temas principales?"
        print(f"\n[Pregunta 2]: {query2}")
        answer2 = await service.query_notebook(nb_id, query2)
        print(f"[Respuesta]: {answer2[:500]}...")

        print("\n" + "=" * 60)
        print("  [OK] TEST FINALIZADO CON EXITO")
        print("  NotebookLM funciona correctamente con PDFs.")
        print("=" * 60)

    except Exception as e:
        print(f"\n[ERROR] DURANTE EL TEST: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await service.close()


if __name__ == "__main__":
    asyncio.run(test_notebooklm_with_pdfs())
