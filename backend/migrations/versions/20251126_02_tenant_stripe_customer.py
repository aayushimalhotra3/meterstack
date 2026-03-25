from alembic import op
import sqlalchemy as sa

revision = "20251126_02_tenant_customer"
down_revision = "20251126_01_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("stripe_customer_id", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "stripe_customer_id")
