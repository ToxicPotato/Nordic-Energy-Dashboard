from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, BigInteger, Text, Numeric, DateTime, UniqueConstraint

Base = declarative_base()

class HourlyPowerPrice(Base):
    __tablename__ = "hourly_power_price"

    id                = Column(BigInteger, primary_key=True)
    region            = Column(Text, nullable=False)
    start_ts_utc      = Column(DateTime(timezone=True), nullable=False)
    end_ts_utc        = Column(DateTime(timezone=True), nullable=False)
    price_nok_per_kwh = Column(Numeric(12,6), nullable=False)
    price_eur_per_kwh = Column(Numeric(12,6))
    exr               = Column(Numeric(12,6))
    
    __table_args__ = (
        UniqueConstraint("region", "start_ts_utc", name="uq_hour_region_start"),
    )
