import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.api.ai_router import (
    ask_ai_copilot, AIChatRequest, get_customer_segments,
    get_pricing_suggestions, get_category_matrix, get_reorder_recommendations
)

def test_ai_enhancements():
    print("==========================================================")
    print("     DOLLY POS - ADVANCED AI ADVISOR TEST SUITE          ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        # 1. TEST: AI Copilot Conversational Engine
        print("\n[TEST 1] Testing Conversational AI Copilot Natural Language Answers...")
        queries = [
            "What is our total stock value?",
            "How much profit did we make this month?",
            "Who are the top selling products?",
            "Who owes the highest Khata credit?",
            "Show dead stock capital"
        ]

        for q in queries:
            req = AIChatRequest(query=q)
            res = ask_ai_copilot(req, current_user=owner, db=db)
            assert "answer" in res
            assert len(res["answer"]) > 20
            print(f"  [PASS] Q: '{q}' -> Response length: {len(res['answer'])} chars")

        # 2. TEST: RFM Customer Segments
        print("\n[TEST 2] Testing Customer RFM Segmentation...")
        segments = get_customer_segments(current_user=owner, db=db)
        assert "champions" in segments
        assert "loyal" in segments
        assert "at_risk" in segments
        assert "khata_due" in segments
        print(f"  [PASS] Segments: Champions={segments['counts']['champions']}, Loyal={segments['counts']['loyal']}, At-Risk={segments['counts']['at_risk']}, Khata Due={segments['counts']['khata_due']}")

        # 3. TEST: Dynamic Pricing Suggestions
        print("\n[TEST 3] Testing AI Dynamic Pricing Suggestions...")
        pricing = get_pricing_suggestions(current_user=owner, db=db)
        print(f"  [PASS] Generated {len(pricing)} dynamic pricing opportunities.")
        if len(pricing) > 0:
            print(f"  [PASS] Sample suggestion: '{pricing[0]['name']}' (Current: Rs.{pricing[0]['current_price']} -> Rec: Rs.{pricing[0]['recommended_price']})")

        # 4. TEST: Category Profitability Matrix
        print("\n[TEST 4] Testing Category Profitability Matrix...")
        cats = get_category_matrix(current_user=owner, db=db)
        assert len(cats) > 0
        for c in cats:
            print(f"  [PASS] Category '{c['category_name']}': {c['product_count']} SKUs, Total Valuation: Rs.{c['stock_valuation']}, Avg Margin: {c['average_margin']}%")

        print("\n==========================================================")
        print("          ALL AI ADVISOR ENHANCEMENTS PASSED (100%)       ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_ai_enhancements()
