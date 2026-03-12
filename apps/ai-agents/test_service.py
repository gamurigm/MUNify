import asyncio
import os
import sys

# Ensure the current directory is in the path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from notebook_service import notebook_service # pyre-ignore
import logfire # pyre-ignore

# Silenciar logfire para el test si no hay token
logfire.configure(send_to_logfire=False)

async def test_notebooklm():
    print("--- INICIANDO TEST DE NOTEBOOKLM SERVICE ---")
    
    # 1. Verificar si existe el archivo de sesión
    if not os.path.exists(notebook_service.storage_path):
        print(f"ERROR: No se encuentra el archivo de sesion en {notebook_service.storage_path}")
        print("Accion requerida: Ejecuta 'venv\\Scripts\\notebooklm login' en una terminal.")
        return

    try:
        # 2. Intentar ingesta de un PDF de prueba (usaremos uno que ya existe en la carpeta)
        test_pdf = "final_test.pdf"
        if not os.path.exists(test_pdf):
            # Crear un mini PDF o usar un string como fuente si el archivo no existe
            print(f"AVISO: {test_pdf} no encontrado, saltando ingesta real.")
            nb_id = "test_nb_id" # Placeholder
        else:
            print(f"--- Probando ingesta de {test_pdf} ---")
            nb_id = await notebook_service.ingest_professional_context(
                "Test Automatizado MUNify", 
                [os.path.abspath(test_pdf)]
            )
            print(f"OK: Notebook creado/usado: {nb_id}")

        # 3. Intentar una consulta simple
        print("--- Probando consulta al notebook ---")
        answer = await notebook_service.query_notebook(
            nb_id, 
            "De que trata este notebook? Responde en una frase corta."
        )
        print(f"IA: {answer}")
        print("--- TEST FINALIZADO CON EXITO ---")

    except Exception as e:
        print(f"ERROR DURANTE EL TEST: {e}")
    finally:
        await notebook_service.close()

if __name__ == "__main__":
    asyncio.run(test_notebooklm())
