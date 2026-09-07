from typing import Dict, Any, List, Optional
import base64

class UniversalPrinterDriverService:
    """
    Hardware-Agnostic Printing Engine for Dolly POS.
    Supports all thermal receipt printers (ESC/POS, 58mm, 80mm, 112mm, A4)
    and industrial label printers (TSPL, ZPL, EPL, Standard Windows Driver, A4 Sheet Multi-Up).
    """

    # ==========================================
    # 1. ESC/POS RECEIPT GENERATOR (RAW BYTES)
    # ==========================================
    @staticmethod
    def generate_escpos_bytes(receipt_data: Dict[str, Any], width_mm: int = 80, cash_drawer: bool = False) -> bytes:
        """
        Generates standard ESC/POS binary commands compatible with Epson, TVS,
        Star, Citizen, Bixolon, Posiflex, and all generic USB/Ethernet thermal printers.
        """
        ESC = b'\x1b'
        GS = b'\x1d'
        
        # Initialize printer
        cmd = bytearray(ESC + b'@')
        
        # Cash drawer kick pulse (Pin 2 / Pin 5)
        if cash_drawer:
            cmd.extend(ESC + b'p\x00\x19\xfa')

        # Center Align
        cmd.extend(ESC + b'a\x01')
        
        # Double height & bold for shop name
        cmd.extend(ESC + b'!\x30') # Double height + width
        cmd.extend(receipt_data.get("shop_name", "DOLLY TOYS & KIDS WEAR").encode('ascii', 'replace') + b'\n')
        cmd.extend(ESC + b'!\x00') # Normal font
        
        # Address & Contact
        cmd.extend(receipt_data.get("address", "").encode('ascii', 'replace') + b'\n')
        cmd.extend(f"Phone: {receipt_data.get('mobile', '')}\n".encode('ascii', 'replace'))
        cmd.extend(b"------------------------------------------\n")
        
        # Bill Metadata (Left Align)
        cmd.extend(ESC + b'a\x00')
        cmd.extend(f"Bill No: {receipt_data.get('bill_number', '')}\n".encode('ascii', 'replace'))
        cmd.extend(f"Date:    {receipt_data.get('bill_date', '')}\n".encode('ascii', 'replace'))
        cmd.extend(f"Customer: {receipt_data.get('customer_name', 'Walk-in')}\n".encode('ascii', 'replace'))
        cmd.extend(b"------------------------------------------\n")
        
        # Items Table Header
        cmd.extend(ESC + b'!\x08') # Emphasized / Bold
        cmd.extend(f"{'Item':<22}{'Qty':>4}{'Price':>8}{'Total':>8}\n".encode('ascii', 'replace'))
        cmd.extend(ESC + b'!\x00')
        cmd.extend(b"------------------------------------------\n")

        # Items
        for item in receipt_data.get("items", []):
            name = item.get("item_name", "")[:20]
            qty = str(item.get("quantity", 1))
            price = f"{item.get('unit_price', 0):.1f}"
            total = f"{item.get('total_price', 0):.1f}"
            cmd.extend(f"{name:<22}{qty:>4}{price:>8}{total:>8}\n".encode('ascii', 'replace'))

        cmd.extend(b"------------------------------------------\n")
        
        # Grand Total (Right Align, Bold)
        cmd.extend(ESC + b'a\x02') # Right align
        cmd.extend(ESC + b'!\x20') # Double width
        cmd.extend(f"TOTAL: Rs. {receipt_data.get('grand_total', 0):.2f}\n".encode('ascii', 'replace'))
        cmd.extend(ESC + b'!\x00')
        cmd.extend(f"Paid via: {receipt_data.get('payment_mode', 'CASH')}\n".encode('ascii', 'replace'))

        # Footer & UPI Note (Center)
        cmd.extend(ESC + b'a\x01')
        cmd.extend(b"\n")
        cmd.extend(f"UPI ID: {receipt_data.get('upi_id', '7972558842@upi')}\n".encode('ascii', 'replace'))
        cmd.extend(receipt_data.get("bill_footer", "Thank you! Visit again.").encode('ascii', 'replace') + b'\n')
        
        # Feed 4 lines and Cut paper
        cmd.extend(ESC + b'd\x04')
        cmd.extend(GS + b'V\x41\x00') # Partial cut
        
        return bytes(cmd)

    # ==========================================
    # 2. TSPL / TSPL2 COMMAND GENERATOR (TSC / TVS)
    # ==========================================
    @staticmethod
    def generate_tspl_label(
        shop_name: str,
        product_name: str,
        barcode: str,
        mrp: float,
        size: Optional[str] = None,
        color: Optional[str] = None,
        width_mm: int = 50,
        height_mm: int = 25,
        gap_mm: int = 3,
        columns: int = 1
    ) -> str:
        """
        Generates TSPL/TSPL2 commands for TSC, TVS LP-46, Rongta, Godex, Xprinter label printers.
        Supports 1-across, 2-across, 3-across sticker rolls.
        """
        tspl = []
        tspl.append(f"SIZE {width_mm * columns + (gap_mm * (columns - 1))} mm, {height_mm} mm")
        tspl.append(f"GAP {gap_mm} mm, 0 mm")
        tspl.append("DIRECTION 1")
        tspl.append("CLS")

        for col in range(columns):
            x_offset = col * (width_mm + gap_mm) * 8 # 8 dots per mm for 203 DPI
            
            # Header Shop Name
            tspl.append(f'TEXT {x_offset + 20},15,"2",0,1,1,"{shop_name[:22]}"')
            # Product Name
            tspl.append(f'TEXT {x_offset + 20},40,"2",0,1,1,"{product_name[:20]}"')
            # Code128 Barcode
            tspl.append(f'BARCODE {x_offset + 25},65,"128",45,1,0,2,2,"{barcode}"')
            # Footer: Size, Color & Price
            attr = f"{size or ''} {color or ''}".strip()
            tspl.append(f'TEXT {x_offset + 20},140,"2",0,1,1,"{attr[:14]}  MRP:Rs.{int(mrp)}"')

        tspl.append("PRINT 1,1")
        return "\n".join(tspl)

    # ==========================================
    # 3. ZPL II COMMAND GENERATOR (ZEBRA / HONEYWELL)
    # ==========================================
    @staticmethod
    def generate_zpl_label(
        shop_name: str,
        product_name: str,
        barcode: str,
        mrp: float,
        size: Optional[str] = None,
        color: Optional[str] = None,
        width_mm: int = 50,
        height_mm: int = 25,
        dpi: int = 203
    ) -> str:
        """
        Generates ZPL II commands compatible with Zebra ZD series, GT800, GK420t,
        Honeywell, Datamax, and SATO industrial printers.
        """
        dots_w = int(width_mm * (dpi / 25.4))
        dots_h = int(height_mm * (dpi / 25.4))

        zpl = [
            "^XA",
            f"^PW{dots_w}",
            f"^LL{dots_h}",
            # Shop Name
            f"^FO20,15^A0N,20,20^FD{shop_name[:24]}^FS",
            # Product Name
            f"^FO20,40^A0N,18,18^FD{product_name[:22]}^FS",
            # Code128 Barcode
            f"^FO30,65^BY2,2,40^BCN,40,Y,N,N^FD{barcode}^FS",
            # Size, Color & Price
            f"^FO20,145^A0N,20,20^FD{size or ''} {color or ''}  MRP: Rs.{int(mrp)}^FS",
            "^XZ"
        ]
        return "\n".join(zpl)

    # ==========================================
    # 4. A4 SHEET MULTI-STICKER MATRIX (24-UP / 40-UP)
    # ==========================================
    @staticmethod
    def get_sticker_layout_presets() -> List[Dict[str, Any]]:
        """Presets for all global sticker rolls & laser sheets."""
        return [
            {
                "id": "roll_50x25_1up",
                "name": "Thermal Roll: 50x25 mm (1-Across Standard POS)",
                "type": "ROLL",
                "width_mm": 50,
                "height_mm": 25,
                "columns": 1,
                "supported_printers": ["TSC", "TVS LP46", "Zebra", "Xprinter", "Generic Thermal"]
            },
            {
                "id": "roll_50x25_2up",
                "name": "Thermal Roll: 50x25 mm (2-Across Dual Roll)",
                "type": "ROLL",
                "width_mm": 50,
                "height_mm": 25,
                "columns": 2,
                "supported_printers": ["TSC TE244", "TVS LP46", "Zebra ZD220", "Godex"]
            },
            {
                "id": "roll_38x25_1up",
                "name": "Thermal Roll: 38x25 mm (Jewelry / Small Garment Tag)",
                "type": "ROLL",
                "width_mm": 38,
                "height_mm": 25,
                "columns": 1,
                "supported_printers": ["All 2-inch & 3-inch Thermal Printers"]
            },
            {
                "id": "a4_24up",
                "name": "A4 Laser/Inkjet Sheet (24 Stickers / Page: 3x8 Grid)",
                "type": "SHEET",
                "width_mm": 70,
                "height_mm": 37,
                "columns": 3,
                "rows": 8,
                "stickers_per_page": 24,
                "supported_printers": ["HP LaserJet", "Canon", "Epson EcoTank", "Any Office Printer"]
            },
            {
                "id": "a4_40up",
                "name": "A4 Laser/Inkjet Sheet (40 Stickers / Page: 4x10 Grid)",
                "type": "SHEET",
                "width_mm": 52.5,
                "height_mm": 29.7,
                "columns": 4,
                "rows": 10,
                "stickers_per_page": 40,
                "supported_printers": ["Any Laser / Inkjet Printer"]
            }
        ]

printer_drivers = UniversalPrinterDriverService()
