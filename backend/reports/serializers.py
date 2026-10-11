from datetime import date

from rest_framework import serializers

from .models import Expense, OtherIncome, RecurringExpense
from .schedule_c import CATEGORY_LABELS, CATEGORY_LINES


class ExpenseSerializer(serializers.ModelSerializer):
    category_label = serializers.SerializerMethodField()
    schedule_c_line = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = ["id", "date", "amount", "category", "category_label", "schedule_c_line", "description", "vendor", "note", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_category_label(self, expense):
        return CATEGORY_LABELS.get(expense.category, expense.category)

    def get_schedule_c_line(self, expense):
        return CATEGORY_LINES.get(expense.category)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("The amount needs to be more than zero.")
        return value

    def validate_date(self, value):
        # An expense can't be in the future. If it's paid later, it belongs on the day it's paid.
        if value > date.today():
            raise serializers.ValidationError("An expense can't be dated in the future.")
        return value


class RecurringExpenseSerializer(serializers.ModelSerializer):
    category_label = serializers.SerializerMethodField()
    schedule_c_line = serializers.SerializerMethodField()

    class Meta:
        model = RecurringExpense
        fields = [
            "id", "amount", "category", "category_label", "schedule_c_line", "description", "vendor", "note",
            "start_date", "ended", "ended_on", "created_at",
        ]
        read_only_fields = ["id", "ended", "ended_on", "created_at"]

    def get_category_label(self, expense):
        return CATEGORY_LABELS.get(expense.category, expense.category)

    def get_schedule_c_line(self, expense):
        return CATEGORY_LINES.get(expense.category)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("The amount needs to be more than zero.")
        return value

    def validate_start_date(self, value):
        if value > date.today():
            raise serializers.ValidationError("The first month can't be in the future.")
        return value


class OtherIncomeSerializer(serializers.ModelSerializer):
    class Meta:
        model = OtherIncome
        fields = ["id", "date", "amount", "description", "note", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("The amount needs to be more than zero.")
        return value

    def validate_date(self, value):
        if value > date.today():
            raise serializers.ValidationError("Other income can't be dated in the future.")
        return value
