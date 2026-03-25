from ..config import STRIPE_API_KEY


class _StripeUnavailable:
    api_key = ""

    class Webhook:
        @staticmethod
        def construct_event(*args, **kwargs):
            raise RuntimeError("Stripe SDK not installed")

    def __getattr__(self, name: str):
        raise RuntimeError("Stripe SDK not installed")


def get_stripe():
    try:
        import stripe
    except ModuleNotFoundError:
        return _StripeUnavailable()
    stripe.api_key = STRIPE_API_KEY
    return stripe
