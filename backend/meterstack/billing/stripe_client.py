import stripe
from ..config import STRIPE_API_KEY

def get_stripe():
    stripe.api_key = STRIPE_API_KEY
    return stripe
