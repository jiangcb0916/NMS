from flask_login import LoginManager
from flask_session import Session
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()
login_manager = LoginManager()
server_session = Session()
