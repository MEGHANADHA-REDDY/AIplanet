from datetime import datetime

class ChatLog:
    def __init__(self, id, workflow_id, user_message, bot_response, timestamp=None):
        self.id = id
        self.workflow_id = workflow_id
        self.user_message = user_message
        self.bot_response = bot_response
        self.timestamp = timestamp or datetime.utcnow() 