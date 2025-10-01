from backend.db import engine
from backend.models import Base
if __name__ == "__main__":
    Base.metadata.create_all(engine)
