from datetime import datetime

class Document:
    def __init__(self, id, filename, upload_time=None, status='uploaded'):
        self.id = id
        self.filename = filename
        self.upload_time = upload_time or datetime.utcnow()
        self.status = status 