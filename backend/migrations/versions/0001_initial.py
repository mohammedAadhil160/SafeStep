"""
SafeStep Database Migration — Initial Schema
Run with: alembic upgrade head
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ─── Revision metadata ────────────────────────────────────────────────────────
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable PostGIS
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # ── safety_points ─────────────────────────────────────────────────────────
    op.create_table(
        'safety_points',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('latitude', sa.Float, nullable=False),
        sa.Column('longitude', sa.Float, nullable=False),
        sa.Column('lighting_score', sa.Float, nullable=False, server_default='5.0'),
        sa.Column('police_proximity_km', sa.Float, nullable=False, server_default='2.0'),
        sa.Column('sentiment_score', sa.Float, nullable=False, server_default='5.0'),
        sa.Column('crowd_density', sa.Float, nullable=False, server_default='5.0'),
        sa.Column('incident_count_30d', sa.Integer, nullable=False, server_default='0'),
        sa.Column('safety_index', sa.Float, nullable=True),
        sa.Column('risk_level', sa.String(20), nullable=True),
        sa.Column('source', sa.String(50), server_default='system'),
        sa.Column('verified', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_safety_points_lat_lng', 'safety_points', ['latitude', 'longitude'])
    op.execute("""
        ALTER TABLE safety_points
        ADD COLUMN geom geometry(Point, 4326)
        GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED;
    """)
    op.execute("CREATE INDEX idx_safety_points_geom ON safety_points USING GIST(geom);")

    # ── user_reports ──────────────────────────────────────────────────────────
    op.create_table(
        'user_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('latitude', sa.Float, nullable=False),
        sa.Column('longitude', sa.Float, nullable=False),
        sa.Column('report_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.Integer, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('anonymous', sa.Boolean, server_default='true'),
        sa.Column('user_id', sa.String(100), nullable=True),
        sa.Column('verified', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # ── incidents ─────────────────────────────────────────────────────────────
    op.create_table(
        'incidents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('latitude', sa.Float, nullable=False),
        sa.Column('longitude', sa.Float, nullable=False),
        sa.Column('incident_type', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('severity', sa.Integer, nullable=False),
        sa.Column('distance_m', sa.Float, nullable=True),
        sa.Column('occurred_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.execute("CREATE INDEX idx_incidents_occurred_at ON incidents(occurred_at DESC);")

    # ── emergency_contacts ────────────────────────────────────────────────────
    op.create_table(
        'emergency_contacts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.String(100), nullable=False),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('email', sa.String(200), nullable=True),
        sa.Column('is_primary', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('idx_emergency_contacts_user', 'emergency_contacts', ['user_id'])


def downgrade() -> None:
    op.drop_table('emergency_contacts')
    op.drop_table('incidents')
    op.drop_table('user_reports')
    op.drop_table('safety_points')
    op.execute("DROP EXTENSION IF EXISTS postgis;")
