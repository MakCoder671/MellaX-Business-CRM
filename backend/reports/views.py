from datetime import date

from django.db.models import Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from invoicing.models import Invoice, PaymentRecord


class ProfitLossView(APIView):
    """Basic P&L (business_plan.MD, Basic Plan): revenue/refunds recorded
    via PaymentRecord, plus tax collected from invoices in the same window
    — built for tax filing, not full accrual accounting."""

    def get(self, request):
        start = request.query_params.get("start", date.today().replace(month=1, day=1))
        end = request.query_params.get("end", date.today())

        payments = PaymentRecord.objects.for_account(request.user).filter(
            date_received__gte=start, date_received__lte=end
        )
        revenue = payments.filter(is_refund=False).aggregate(total=Sum("amount"))["total"] or 0
        refunds = payments.filter(is_refund=True).aggregate(total=Sum("amount"))["total"] or 0

        tax_collected = (
            Invoice.objects.for_account(request.user)
            .filter(issued_date__gte=start, issued_date__lte=end)
            .aggregate(total=Sum("tax_amount"))["total"]
            or 0
        )

        return Response(
            {
                "start": start,
                "end": end,
                "revenue": revenue,
                "refunds": refunds,
                "net": revenue - refunds,
                "tax_collected": tax_collected,
            }
        )
