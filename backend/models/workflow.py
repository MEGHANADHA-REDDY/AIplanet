from datetime import datetime

class Workflow:
    def __init__(self, id, name, definition, created_at=None):
        self.id = id
        self.name = name
        self.definition = definition  # JSON string or dict
        self.created_at = created_at or datetime.utcnow() 