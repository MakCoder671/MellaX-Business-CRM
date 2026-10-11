from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import BusinessAccount
from clients.models import Client
from invoicing.models import Invoice, InvoiceLineItem, PaymentRecord, TenderType
from scheduling.models import Appointment, Calendar
from services.models import Service

from .exports import EXPORT_KINDS
from .growth import lapsed_clients, period_metrics
from .models import Expense
from .schedule_c import SCHEDULE_C_CATEGORIES
from .tax import quarter_summary, year_summary


class ReportFixture(TestCase):
    """Two paid visits in one year, one refund, and some expenses. Small enough to check by hand."""

    def setUp(self):
        self.account = BusinessAccount.objects.create_user(
            email="reports@example.com", business_name="Report Co", password="testpass123", plan_tier="plus",
            service_tax_percent=Decimal("10"), product_tax_percent=Decimal("5"),
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.account)
        self.cash = TenderType.objects.get(name="Cash", business_account=None)
        self.haircut = Service.objects.create(business_account=self.account, name="Haircut", price=Decimal("40"), cost=Decimal("0"), is_taxable=True)
        self.pomade = Service.objects.create(business_account=self.account, name="Pomade", price=Decimal("20"), cost=Decimal("8"), is_product=True, is_taxable=True)
        self.untaxed = Service.objects.create(business_account=self.account, name="Consult", price=Decimal("50"), cost=Decimal("0"), is_taxable=False)
        self.ana = Client.objects.create(business_account=self.account, first_name="Ana", last_name="Diaz")
        self.ben = Client.objects.create(business_account=self.account, first_name="Ben", last_name="Cole")
        self.year = date.today().year

    def paid_invoice(self, client, number, lines):
        invoice = Invoice.objects.create(business_account=self.account, client=client, invoice_number=number, status=Invoice.STATUS_PAID)
        for service, qty in lines:
            InvoiceLineItem.objects.create(
                invoice=invoice, service=service, quantity=qty, unit_price=service.price,
                unit_cost=service.cost if service.is_product else None,
            )
        invoice.tax_amount = Decimal("0")
        for item in invoice.line_items.all():
            if item.service.is_taxable:
                rate = self.account.product_tax_percent if item.service.is_product else self.account.service_tax_percent
                invoice.tax_amount += item.net_amount() * rate / Decimal("100")
        invoice.save()
        PaymentRecord.objects.create(
            business_account=self.account, client=client, invoice=invoice, tender_type=self.cash,
            amount=invoice.total_due(),
        )
        return invoice


class ExpenseTests(ReportFixture):
    def test_expense_is_saved_and_listed(self):
        response = self.api.post("/api/reports/expenses/", {
            "date": date.today().isoformat(), "amount": "120.00", "category": "supplies",
            "description": "Towels", "vendor": "Costco",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["schedule_c_line"], "22")
        self.assertEqual(len(self.api.get("/api/reports/expenses/").json()), 1)

    def test_amount_must_be_positive_and_date_not_in_future(self):
        bad_amount = self.api.post("/api/reports/expenses/", {"date": date.today().isoformat(), "amount": "0", "category": "supplies", "description": "x"}, format="json")
        self.assertEqual(bad_amount.status_code, 400)
        future = self.api.post("/api/reports/expenses/", {"date": (date.today() + timedelta(days=3)).isoformat(), "amount": "5", "category": "supplies", "description": "x"}, format="json")
        self.assertEqual(future.status_code, 400)

    def test_expenses_are_private_to_the_account(self):
        other = BusinessAccount.objects.create_user(email="other@example.com", business_name="Other", password="testpass123")
        Expense.objects.create(business_account=other, date=date.today(), amount=Decimal("99"), category="supplies", description="theirs")
        self.assertEqual(self.api.get("/api/reports/expenses/").json(), [])

    def test_profit_and_loss_subtracts_expenses(self):
        self.paid_invoice(self.ana, "INV-1", [(self.haircut, 1)])
        Expense.objects.create(business_account=self.account, date=date.today(), amount=Decimal("15"), category="supplies", description="Towels")
        start, end = date(self.year, 1, 1), date.today()
        data = self.api.get(f"/api/reports/profit-loss/?start={start}&end={end}").json()
        self.assertEqual(Decimal(data["expenses"]), Decimal("15.00"))
        self.assertEqual(Decimal(data["profit"]), Decimal(data["gross_profit"]) - Decimal("15"))


class GrowthTests(ReportFixture):
    def test_average_ticket_and_returning_clients(self):
        # Ana visits twice. Her first visit is last year, so she's a returning client this year.
        last_year = date(self.year - 1, 6, 1)
        old = self.paid_invoice(self.ana, "INV-OLD", [(self.haircut, 1)])
        Invoice.objects.filter(pk=old.pk).update(issued_date=last_year)
        self.paid_invoice(self.ana, "INV-NOW", [(self.haircut, 1)])
        self.paid_invoice(self.ben, "INV-BEN", [(self.haircut, 1), (self.pomade, 1)])

        metrics = period_metrics(self.account, date(self.year, 1, 1), date.today())
        self.assertEqual(metrics["paid_invoices"], 2)
        self.assertEqual(metrics["clients_served"], 2)
        self.assertEqual(metrics["returning_clients"], 1)  # Ana came back; Ben is new
        self.assertEqual(metrics["returning_rate"], Decimal("50.0"))

    def test_growth_endpoint_returns_comparison_and_top_services(self):
        self.paid_invoice(self.ana, "INV-X", [(self.haircut, 2)])
        data = self.api.get(f"/api/reports/growth/?start={self.year}-01-01&end={date.today()}").json()
        self.assertIn("last_year", data)
        self.assertEqual(data["top_services"][0]["name"], "Haircut")
        self.assertEqual(Decimal(data["top_services"][0]["revenue"]), Decimal("80.00"))

    def test_lapsed_clients_are_the_ones_not_seen_recently(self):
        old = self.paid_invoice(self.ben, "INV-LATE", [(self.haircut, 1)])
        Invoice.objects.filter(pk=old.pk).update(issued_date=date.today() - timedelta(days=100))
        self.paid_invoice(self.ana, "INV-FRESH", [(self.haircut, 1)])
        result = lapsed_clients(self.account)
        self.assertEqual(result["over_90_days"], 1)
        self.assertEqual(result["over_60_days"], 1)
        self.assertEqual(result["list"][0]["name"], "Ben Cole")

    def test_busiest_times_skip_cancelled_bookings(self):
        calendar = Calendar.objects.create(business_account=self.account, name="Main")
        when = timezone.now()
        Appointment.objects.create(business_account=self.account, calendar=calendar, client=self.ana, datetime=when, duration_minutes=60)
        Appointment.objects.create(business_account=self.account, calendar=calendar, client=self.ben, datetime=when, duration_minutes=60, status=Appointment.STATUS_CANCELLED)
        data = self.api.get(f"/api/reports/growth/?start={self.year}-01-01&end={date.today()}").json()
        self.assertEqual(data["bookings"]["bookings"], 2)
        self.assertEqual(data["bookings"]["cancelled"], 1)
        self.assertEqual(sum(row["bookings"] for row in data["busiest"]["by_weekday"]), 1)

    def test_monthly_series_has_twelve_months_oldest_first(self):
        data = self.api.get("/api/reports/monthly/?months=12").json()
        self.assertEqual(len(data["months"]), 12)
        self.assertTrue(data["months"][-1]["is_partial"])  # this month isn't finished yet
        self.assertLess(data["months"][0]["start"], data["months"][-1]["start"])


class TaxTests(ReportFixture):
    def test_year_summary_follows_schedule_c_order(self):
        self.paid_invoice(self.ana, "INV-T1", [(self.haircut, 1)])
        Expense.objects.create(business_account=self.account, date=date.today(), amount=Decimal("30"), category="advertising", description="Flyers")
        Expense.objects.create(business_account=self.account, date=date.today(), amount=Decimal("10"), category="supplies", description="Gloves")
        data = self.api.get(f"/api/reports/tax/year/?year={self.year}").json()
        lines = {row["line"]: Decimal(row["amount"]) for row in data["lines"]}
        self.assertEqual(lines["1"], Decimal("40.00"))  # gross receipts
        self.assertEqual(lines["8"], Decimal("30.00"))  # advertising
        self.assertEqual(lines["22"], Decimal("10.00"))  # supplies
        self.assertEqual(lines["28"], Decimal("40.00"))  # total expenses
        self.assertEqual(lines["31"], Decimal("0.00"))  # 40 receipts - 40 expenses
        # Every Schedule C category appears, even at zero, so nothing looks missing.
        expense_rows = [row for row in data["lines"] if row["line"] not in {"1", "2", "3", "4", "5", "6", "7", "28", "29", "31"}]
        self.assertEqual(len(expense_rows), len(SCHEDULE_C_CATEGORIES))

    def test_quarters_split_taxable_and_untaxed_sales(self):
        # Haircut $40 (taxable at 10%), Consult $50 (not taxable).
        self.paid_invoice(self.ana, "INV-Q1", [(self.haircut, 1), (self.untaxed, 1)])
        data = self.api.get(f"/api/reports/tax/quarters/?year={self.year}").json()
        this_quarter = next(q for q in data["quarters"] if date.fromisoformat(q["start"]) <= date.today() <= date.fromisoformat(q["end"]))
        self.assertEqual(Decimal(this_quarter["sales"]), Decimal("90.00"))
        self.assertEqual(Decimal(this_quarter["taxable_sales"]), Decimal("40.00"))
        self.assertEqual(Decimal(this_quarter["non_taxable_sales"]), Decimal("50.00"))
        self.assertEqual(Decimal(this_quarter["tax_collected"]), Decimal("4.00"))

    def test_product_sales_use_the_product_tax_rate(self):
        invoice = self.paid_invoice(self.ana, "INV-PROD", [(self.pomade, 1)])
        invoice.refresh_from_db()
        self.assertEqual(invoice.tax_amount, Decimal("1.00"))  # $20 product at 5%, not 10%

    def test_invoice_tax_is_calculated_with_the_product_rate_in_the_api(self):
        from invoicing.views import _recompute_tax

        invoice = self.paid_invoice(self.ana, "INV-RECALC", [(self.pomade, 1)])
        _recompute_tax(invoice)
        invoice.refresh_from_db()
        self.assertEqual(invoice.tax_amount, Decimal("1.00"))


class ExportTests(ReportFixture):
    def test_every_export_downloads_as_csv(self):
        self.paid_invoice(self.ana, "INV-E1", [(self.haircut, 1)])
        start, end = f"{self.year}-01-01", date.today().isoformat()
        for kind in EXPORT_KINDS:
            query = f"?year={self.year}" if kind == "schedule-c" else f"?start={start}&end={end}"
            response = self.api.get(f"/api/reports/export/{kind}/{query}")
            self.assertEqual(response.status_code, 200, kind)
            self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
            self.assertIn("attachment", response["Content-Disposition"])

    def test_payments_export_has_the_right_rows(self):
        self.paid_invoice(self.ana, "INV-CSV", [(self.haircut, 1)])
        start, end = f"{self.year}-01-01", date.today().isoformat()
        body = self.api.get(f"/api/reports/export/payments/?start={start}&end={end}").content.decode()
        self.assertIn("INV-CSV", body)
        self.assertIn("Ana Diaz", body)
        self.assertIn("44.00", body)  # the customer paid the total, sales tax included

    def test_unknown_export_is_not_found(self):
        self.assertEqual(self.api.get("/api/reports/export/secrets/").status_code, 404)


class SalesTaxSeparationTests(ReportFixture):
    def test_sales_tax_is_not_counted_as_income(self):
        # A $40 haircut with 10% tax is paid as $44. Only $40 is income.
        self.paid_invoice(self.ana, "INV-TAX", [(self.haircut, 1)])
        start, end = date(self.year, 1, 1), date.today()
        data = self.api.get(f"/api/reports/profit-loss/?start={start}&end={end}").json()
        self.assertEqual(Decimal(data["revenue"]), Decimal("40.00"))
        self.assertEqual(Decimal(data["tax_collected"]), Decimal("4.00"))
        metrics = period_metrics(self.account, start, end)
        self.assertEqual(metrics["net_revenue"], Decimal("40.00"))
        self.assertEqual(metrics["sales_tax_collected"], Decimal("4.00"))
        self.assertEqual(metrics["average_ticket"], Decimal("40.00"))


class YearOverYearTests(ReportFixture):
    def test_no_last_year_sales_means_no_percentage(self):
        from .growth import _change

        self.assertIsNone(_change(Decimal("100"), Decimal("0")))
        self.assertIsNone(_change(Decimal("100"), None))

    def test_normal_change_is_a_percentage(self):
        from .growth import _change

        self.assertEqual(_change(Decimal("150"), Decimal("100")), 50.0)
        self.assertEqual(_change(Decimal("50"), Decimal("100")), -50.0)


class RepeatingExpenseTests(ReportFixture):
    def make_series(self, start, amount="100.00", description="Mower service"):
        from .models import RecurringExpense

        return RecurringExpense.objects.create(
            business_account=self.account, amount=Decimal(amount), category="repairs_and_maintenance",
            description=description, start_date=start,
        )

    def test_one_entry_per_month_through_today(self):
        from .recurring import ensure_recurring

        series = self.make_series(date(2026, 1, 10))
        ensure_recurring(self.account, today=date(2026, 4, 30))
        entries = Expense.objects.filter(recurring=series).order_by("date")
        self.assertEqual([e.date for e in entries], [date(2026, 1, 10), date(2026, 2, 10), date(2026, 3, 10), date(2026, 4, 10)])

    def test_running_it_again_never_duplicates(self):
        from .recurring import ensure_recurring

        series = self.make_series(date(2026, 1, 10))
        ensure_recurring(self.account, today=date(2026, 4, 30))
        ensure_recurring(self.account, today=date(2026, 4, 30))
        self.assertEqual(Expense.objects.filter(recurring=series).count(), 4)

    def test_day_31_becomes_the_last_day_of_shorter_months(self):
        from .recurring import ensure_recurring

        series = self.make_series(date(2026, 1, 31))
        ensure_recurring(self.account, today=date(2026, 4, 30))
        entries = Expense.objects.filter(recurring=series).order_by("date")
        self.assertEqual([e.date for e in entries], [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)])

    def test_a_month_waits_until_its_day_comes(self):
        from .recurring import ensure_recurring

        series = self.make_series(date(2026, 1, 10))
        ensure_recurring(self.account, today=date(2026, 4, 5))  # April 10 hasn't happened yet
        self.assertEqual(Expense.objects.filter(recurring=series).count(), 3)
        ensure_recurring(self.account, today=date(2026, 4, 10))
        self.assertEqual(Expense.objects.filter(recurring=series).count(), 4)

    def test_stopping_keeps_the_past_and_removes_the_future(self):
        from .recurring import ensure_recurring, stop_recurring

        series = self.make_series(date(2026, 1, 10))
        ensure_recurring(self.account, today=date(2026, 4, 30))
        stop_recurring(series, today=date(2026, 2, 20))
        self.assertEqual(sorted(e.date for e in Expense.objects.filter(recurring=series)), [date(2026, 1, 10), date(2026, 2, 10)])
        ensure_recurring(self.account, today=date(2026, 6, 30))  # a stopped series adds nothing new
        self.assertEqual(Expense.objects.filter(recurring=series).count(), 2)

    def test_reports_see_repeating_costs_without_anyone_opening_the_expenses_tab(self):
        self.make_series(date(2026, 1, 1), amount="650.00", description="Booth rent")
        start, end = date(self.year, 1, 1), date.today()
        data = self.api.get(f"/api/reports/profit-loss/?start={start}&end={end}").json()
        self.assertGreater(Decimal(data["expenses"]), Decimal("0"))

    def test_deleting_through_the_api_stops_the_repeat(self):
        response = self.api.post("/api/reports/recurring-expenses/", {
            "amount": "45.00", "category": "office_expense", "description": "Booking software",
            "start_date": date.today().replace(day=1).isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 201)
        series_id = response.json()["id"]
        self.assertEqual(self.api.delete(f"/api/reports/recurring-expenses/{series_id}/").status_code, 204)
        self.assertEqual(self.api.get("/api/reports/recurring-expenses/").json(), [])


class TaxPacketTests(ReportFixture):
    def test_other_income_goes_on_line_6_and_adds_to_profit(self):
        from .models import OtherIncome

        OtherIncome.objects.create(business_account=self.account, date=date.today(), amount=Decimal("25"), description="Tips")
        self.paid_invoice(self.ana, "INV-PK1", [(self.haircut, 1)])
        data = self.api.get(f"/api/reports/tax/year/?year={self.year}").json()
        lines = {row["line"]: Decimal(row["amount"]) for row in data["lines"]}
        self.assertEqual(lines["6"], Decimal("25.00"))
        self.assertEqual(lines["7"], Decimal("65.00"))  # 40 sales + 25 tips
        self.assertEqual(lines["31"], Decimal("65.00"))

    def test_packet_has_everything_the_accountant_asks_for(self):
        from .models import OtherIncome

        Expense.objects.create(business_account=self.account, date=date.today(), amount=Decimal("30"), category="supplies", description="Gloves", vendor="Costco")
        OtherIncome.objects.create(business_account=self.account, date=date.today(), amount=Decimal("10"), description="Reimbursement")
        self.paid_invoice(self.ana, "INV-PK2", [(self.haircut, 1)])
        packet = self.api.get(f"/api/reports/tax/packet/?year={self.year}").json()
        self.assertEqual(packet["year"], self.year)
        self.assertEqual(len(packet["expenses"]), 1)
        self.assertEqual(packet["expenses"][0]["line"], "22")
        self.assertEqual(len(packet["other_income"]), 1)
        self.assertEqual(len(packet["invoices"]), 1)
        self.assertIn("6", [row["line"] for row in packet["summary"]["lines"]])  # other income line is in the summary
        self.assertIn("readiness", packet)

    def test_readiness_flags_unpaid_invoices_and_missing_product_costs(self):
        invoice = self.paid_invoice(self.ana, "INV-PK3", [(self.pomade, 1)])
        invoice.status = Invoice.STATUS_UNPAID
        invoice.save()
        checks = {c["key"]: c for c in self.api.get(f"/api/reports/tax/packet/?year={self.year}").json()["readiness"]}
        self.assertEqual(checks["unpaid"]["status"], "warn")
        self.assertEqual(checks["product_cost"]["status"], "ok")  # the fixture gives the pomade a cost
        self.assertIn(checks["expenses"]["status"], ("ok", "warn"))

    def test_other_income_api_is_private_and_validated(self):
        ok = self.api.post("/api/reports/other-income/", {"date": date.today().isoformat(), "amount": "12.50", "description": "Tip jar"}, format="json")
        self.assertEqual(ok.status_code, 201)
        bad = self.api.post("/api/reports/other-income/", {"date": date.today().isoformat(), "amount": "0", "description": "x"}, format="json")
        self.assertEqual(bad.status_code, 400)
