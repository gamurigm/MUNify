
import re
from typing import List, Dict, Any

class ResolutionAST:
    def __init__(self):
        # Gerundios y adjetivos comunes en preambulatorias (Español)
        self.PREAMB_VERBS = [
            "Reconociendo", "Teniendo en cuenta", "Consciente de", "Observando", 
            "Recordando", "Lamentando", "Preocupado", "Alarmado", "Deseando", 
            "Convencido de", "Reafirmando", "Acogiendo con beneplácito", 
            "Tomando nota", "Guiado por", "Subrayando", "Destacando"
        ]
        
        # Verbos de acción en operativas (Español)
        self.OPERATIVE_VERBS = [
            "Decide", "Insta", "Solicita", "Exhorta", "Condena", "Aprueba", 
            "Pide", "Hace un llamado", "Expresa", "Autoriza", "Asigna", 
            "Invita", "Encomienda", "Reitera", "Subraya"
        ]

    def validate_structure(self, latex_content: str) -> Dict[str, Any]:
        errors = []
        is_resolution = "\\section*{Preámbulo}" in latex_content or "reconociendo" in latex_content.lower()
        
        if not is_resolution:
            return {"valid": True, "errors": [], "type": "generic"}

        # 1. Buscar sección de preámbulo
        preamb_match = re.search(r"\\section\*\{Preámbulo\}(.*?)\\section\*\{Cláusulas Operativas\}", latex_content, re.DOTALL | re.IGNORECASE)
        if preamb_match:
            preamb_text = preamb_match.group(1)
            clauses = re.findall(r"\\item (.*?)(?:;|,|\.|\n)", preamb_text)
            for c in clauses:
                c = c.strip()
                if not any(c.startswith(v) for v in self.PREAMB_VERBS):
                    errors.append(f"Cláusula preambulatoria no inicia con verbo estándar: \"{c[:30]}...\"")
        else:
            errors.append("Falta sección de Preámbulo o Cláusulas Operativas con formato estándar.")

        # 2. Buscar sección operativa
        op_match = re.search(r"\\section\*\{Cláusulas Operativas\}(.*?)(\\end\{document\}|\\end\{enumerate\})", latex_content, re.DOTALL | re.IGNORECASE)
        if op_match:
            op_text = op_match.group(1)
            # Buscar items numerados o \item
            clauses = re.findall(r"\\item (.*?)(?:;|,|\.|\n)", op_text)
            for i, c in enumerate(clauses):
                c = c.strip()
                # En operativas MUN, a veces el número está en el \item o antes del verbo
                # Buscamos que contenga un verbo operativo
                if not any(v in c for v in self.OPERATIVE_VERBS):
                    errors.append(f"Cláusula operativa {i+1} no parece contener un verbo de acción estándar.")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "type": "resolution"
        }

resolution_ast = ResolutionAST()
