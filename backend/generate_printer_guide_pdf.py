import os
import sys

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(36, 25, "DOLLY POS — Hardware & Barcode Master Engineering Manual")
        self.drawRightString(A4[0] - 36, 25, f"Page {self._pageNumber} of {page_count}")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 35, A4[0] - 36, 35)
        self.restoreState()

def create_guide_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=40,
        bottomMargin=45
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a')
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#e11d48')
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=12,
        spaceAfter=6
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )

    bold_body = ParagraphStyle(
        'BodyDarkBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#0f172a')
    )

    tip_style = ParagraphStyle(
        'TipText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#9f1239')
    )

    story = []

    # 1. Title Banner
    story.append(Paragraph("DOLLY TOYS & KIDS WEAR — HARDWARE MANUAL", subtitle_style))
    story.append(Paragraph("TSC TE244 Thermal Barcode Printer & BarTender Complete Guide", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Step-by-Step Calibration, 1-UP vs 2-UP Zero-Waste Setup, Windows Driver Configuration & Bulk BarTender Printing", body_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#e11d48'), spaceBefore=2, spaceAfter=12))

    # --- SECTION 1: 1-UP VS 2-UP LABELS ---
    story.append(Paragraph("1. Understanding 1-UP vs 2-UP Label Rolls & Solving Single-Sticker Waste", h1_style))
    story.append(Paragraph(
        "Thermal label rolls used in retail stores come in two primary formats: <b>1-UP (Single Column)</b> and <b>2-UP (Dual Column)</b>. Knowing how the printer handles each format is the key to zero wasted stickers.",
        body_style
    ))
    story.append(Spacer(1, 6))

    roll_table_data = [
        [
            Paragraph("<b>Roll Format</b>", bold_body),
            Paragraph("<b>Physical Layout</b>", bold_body),
            Paragraph("<b>Total Roll Width</b>", bold_body),
            Paragraph("<b>Best Used For</b>", bold_body)
        ],
        [
            Paragraph("<b>50×25 mm 2-UP</b><br/>(Current Standard)", body_style),
            Paragraph("2 stickers side-by-side per row (50mm + 4mm gap + 50mm)", body_style),
            Paragraph("<b>104.0 mm</b>", body_style),
            Paragraph("High-speed mass inventory printing (2 labels per row feed)", body_style)
        ],
        [
            Paragraph("<b>50×25 mm 1-UP</b>", body_style),
            Paragraph("1 sticker per row (50mm width × 25mm height)", body_style),
            Paragraph("<b>50.0 mm</b>", body_style),
            Paragraph("Single-item reprinting, replacement tags, retail price tags", body_style)
        ],
        [
            Paragraph("<b>38×25 mm 2-UP</b>", body_style),
            Paragraph("2 compact stickers side-by-side (38mm + 4mm gap + 38mm)", body_style),
            Paragraph("<b>80.0 mm</b>", body_style),
            Paragraph("Small accessories, socks, compact toy boxes", body_style)
        ],
        [
            Paragraph("<b>50×35 mm / 75×50 mm</b>", body_style),
            Paragraph("1 large apparel tag per row", body_style),
            Paragraph("<b>50.0 mm / 75.0 mm</b>", body_style),
            Paragraph("Hanging tags, boxed items, multi-piece clothing sets", body_style)
        ]
    ]

    roll_table = Table(roll_table_data, colWidths=[110, 190, 80, 140])
    roll_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0f172a')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(roll_table)
    story.append(Spacer(1, 8))

    # Solution to 2-UP single sticker waste
    story.append(Paragraph("💡 How to Solve Single-Sticker Waste on 2-UP Rolls (The Rollback & Slot Selection Trick)", h2_style))
    story.append(Paragraph(
        "When printing an odd number of stickers (e.g., exactly 1 sticker) on a 2-UP roll, the printer prints the left sticker and leaves the right sticker blank. If you roll the paper back into the printer, a standard print will try to print on the left side again (which is already used).",
        body_style
    ))
    story.append(Spacer(1, 4))

    tip_box_data = [[
        Paragraph(
            "<b>Dolly POS Zero-Waste Solution:</b><br/>"
            "1. In Dolly POS Barcode Studio or Inventory Barcode Modal, select <b>Start Slot: Right Sticker (Slot 2) 🔄</b>.<br/>"
            "2. Dolly POS will leave the left slot blank and print <b>directly on the unused right sticker</b>!<br/>"
            "3. This completely prevents wasted stickers when rolling back partially used 2-UP rows.",
            tip_style
        )
    ]]
    tip_box = Table(tip_box_data, colWidths=[520])
    tip_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff1f2')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#fecdd3')),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(tip_box)
    story.append(Spacer(1, 12))

    # --- SECTION 2: WINDOWS DRIVER SETUP ---
    story.append(Paragraph("2. One-Time Windows Laptop Driver Setup (For All Sticker Sizes)", h1_style))
    story.append(Paragraph(
        "To ensure the TSC TE244 printer stops after <b>exactly 25 mm</b> (without rolling 10–12 blank stickers), you must configure the exact stock size in Windows once. Follow these 5 steps:",
        body_style
    ))
    story.append(Spacer(1, 6))

    steps_text = """
    <b>Step 1:</b> Press the <b>Windows Key</b> on your laptop and type <b>Printers & scanners</b> $\\rightarrow$ Press Enter.<br/>
    <b>Step 2:</b> Click on <b>TSC TE244</b> (or <i>TSC TE200 / TE244 Seagull Driver</i>) $\\rightarrow$ Click <b>Printing preferences</b>.<br/>
    <b>Step 3:</b> Go to the <b>Page Setup</b> tab (or <b>Stock</b> tab) $\\rightarrow$ Click <b>New...</b> (or Edit).<br/>
    <b>Step 4:</b> Enter the parameters for your specific label size from the reference table below.<br/>
    <b>Step 5:</b> Go to the <b>Options</b> tab $\\rightarrow$ Set <b>Darkness: 8 to 10</b>, <b>Print Speed: 2.0 in/sec</b> $\\rightarrow$ Click <b>Apply $\\rightarrow$ OK</b>.
    """
    story.append(Paragraph(steps_text, body_style))
    story.append(Spacer(1, 8))

    # Driver Reference Table
    driver_table_data = [
        [
            Paragraph("<b>Stock Name</b>", bold_body),
            Paragraph("<b>Width (mm)</b>", bold_body),
            Paragraph("<b>Height (mm)</b>", bold_body),
            Paragraph("<b>Gap / Pitch</b>", bold_body),
            Paragraph("<b>Sensor Type</b>", bold_body)
        ],
        [
            Paragraph("<b>50x25 2UP</b> (Current)", body_style),
            Paragraph("<b>104.0 mm</b> (or 102.0)", body_style),
            Paragraph("<b>25.0 mm</b>", body_style),
            Paragraph("3.0 mm (or 2.0 mm)", body_style),
            Paragraph("Gap / Transmissive", body_style)
        ],
        [
            Paragraph("<b>50x25 1UP</b>", body_style),
            Paragraph("<b>50.0 mm</b>", body_style),
            Paragraph("<b>25.0 mm</b>", body_style),
            Paragraph("3.0 mm", body_style),
            Paragraph("Gap / Transmissive", body_style)
        ],
        [
            Paragraph("<b>38x25 2UP</b>", body_style),
            Paragraph("<b>80.0 mm</b>", body_style),
            Paragraph("<b>25.0 mm</b>", body_style),
            Paragraph("3.0 mm", body_style),
            Paragraph("Gap / Transmissive", body_style)
        ],
        [
            Paragraph("<b>38x25 1UP</b>", body_style),
            Paragraph("<b>38.0 mm</b>", body_style),
            Paragraph("<b>25.0 mm</b>", body_style),
            Paragraph("3.0 mm", body_style),
            Paragraph("Gap / Transmissive", body_style)
        ],
        [
            Paragraph("<b>50x35 1UP</b>", body_style),
            Paragraph("<b>50.0 mm</b>", body_style),
            Paragraph("<b>35.0 mm</b>", body_style),
            Paragraph("3.0 mm", body_style),
            Paragraph("Gap / Transmissive", body_style)
        ],
        [
            Paragraph("<b>75x50 1UP</b>", body_style),
            Paragraph("<b>75.0 mm</b>", body_style),
            Paragraph("<b>50.0 mm</b>", body_style),
            Paragraph("3.0 mm", body_style),
            Paragraph("Gap / Transmissive", body_style)
        ]
    ]

    driver_table = Table(driver_table_data, colWidths=[120, 95, 95, 95, 115])
    driver_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
    ]))
    story.append(driver_table)
    story.append(Spacer(1, 14))

    # --- SECTION 3: HARDWARE AUTO-CALIBRATION ---
    story.append(Paragraph("3. TSC TE244 Hardware Gap Auto-Calibration (The Button Trick)", h1_style))
    story.append(Paragraph(
        "Whenever you load a new roll of stickers or change label sizes, the printer's optical sensor must calibrate to the transparent gap between stickers. Perform this 10-second hardware calibration:",
        body_style
    ))
    story.append(Spacer(1, 6))

    calib_text = """
    1. Turn the printer power switch <b>OFF</b> (located on the back right).<br/>
    2. Press and <b>HOLD the PAUSE button</b> (on the front top cover).<br/>
    3. While holding the PAUSE button, turn the power switch <b>ON</b>.<br/>
    4. The printer will start feeding 2–3 blank labels to detect the gap sensor, and then <b>STOP</b>.<br/>
    5. Release the PAUSE button. Press the <b>FEED button once</b>: exactly 1 row (25mm) should advance smoothly. Calibration is complete!
    """
    story.append(Paragraph(calib_text, body_style))
    story.append(Spacer(1, 14))

    # --- SECTION 4: BARTENDER MASS PRINTING GUIDE ---
    story.append(Paragraph("4. BarTender Desktop Application — Bulk Database CSV Printing Guide", h1_style))
    story.append(Paragraph(
        "BarTender is an industry-standard desktop software for TSC printers. Dolly POS allows you to export all your queued inventory stickers in <b>1 click into a BarTender-ready CSV database</b>. Here is how to print 100+ labels at once:",
        body_style
    ))
    story.append(Spacer(1, 6))

    bartender_steps = """
    <b>Step 1: Export CSV from Dolly POS:</b><br/>
    In Dolly POS $\\rightarrow$ Go to <b>Barcode Studio</b> (or Inventory Barcode Modal) $\\rightarrow$ Add products to queue $\\rightarrow$ Click <b>📥 Export BarTender CSV</b>. A file named <code>DollyToys_BarTender_Batch.csv</code> will download.<br/><br/>
    <b>Step 2: Create / Open Label in BarTender:</b><br/>
    Open BarTender $\\rightarrow$ File $\\rightarrow$ New $\\rightarrow$ Select <b>TSC TE244</b> $\\rightarrow$ Set Page Size: <b>Width 104 mm, Height 25 mm</b>, 2 Columns (50mm width each).<br/><br/>
    <b>Step 3: Connect the CSV Database:</b><br/>
    1. Click <b>File $\\rightarrow$ Database Connection Setup</b> (or Database Wizard).<br/>
    2. Select <b>Text File</b> $\\rightarrow$ Click Next $\\rightarrow$ Browse and select the downloaded <code>DollyToys_BarTender_Batch.csv</code>.<br/>
    3. Click <b>Finish</b>. BarTender will now have access to all columns: <code>ProductName</code>, <code>Size</code>, <code>Color</code>, <code>Barcode</code>, and <code>MRP</code>.<br/><br/>
    <b>Step 4: Link Fields to Label Design:</b><br/>
    - Double click the <b>Product Title</b> text box $\\rightarrow$ Data Source: Choose <b>Database Field $\\rightarrow$ ProductName</b>.<br/>
    - Double click the <b>Size/Color</b> text box $\\rightarrow$ Data Source: Choose <b>Database Field $\\rightarrow$ Size / Color</b>.<br/>
    - Double click the <b>Barcode Object (Code128)</b> $\\rightarrow$ Data Source: Choose <b>Database Field $\\rightarrow$ Barcode</b>.<br/>
    - Double click the <b>MRP</b> text box $\\rightarrow$ Data Source: Choose <b>Database Field $\\rightarrow$ MRP</b>.<br/><br/>
    <b>Step 5: Print All Records:</b><br/>
    Click <b>File $\\rightarrow$ Print</b> $\\rightarrow$ Under Records, select <b>All Records</b> $\\rightarrow$ Click <b>Print</b>. The TSC TE244 will print all barcodes consecutively with 100% precision!
    """
    story.append(Paragraph(bartender_steps, body_style))
    story.append(Spacer(1, 14))

    # --- SECTION 5: IBALL LS392 LASER SCANNER GUIDE ---
    story.append(Paragraph("5. iBall LS392 Laser Scanner Best Practices", h1_style))
    scanner_text = """
    - <b>Optimal Distance:</b> Hold the iBall LS392 laser scanner approximately <b>15–20 cm (6–8 inches)</b> away from the sticker.<br/>
    - <b>Aiming Line:</b> Direct the red horizontal laser beam straight across the horizontal center of the vertical bars.<br/>
    - <b>Darkness / Contrast:</b> If the scanner struggles, ensure printer <b>Darkness is set to 8–10</b> in Windows preferences. Deep black bars produce the strongest optical reflection for laser diodes.<br/>
    - <b>Quiet Zones:</b> Dolly POS stickers automatically maintain a clean 1.2mm white margin on both sides so the scanner instantly detects the Start and Stop characters.
    """
    story.append(Paragraph(scanner_text, body_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Guide PDF generated successfully: {filename}")

if __name__ == "__main__":
    out_pdf = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "TSC_TE244_Thermal_Printer_Setup_Guide.pdf")
    create_guide_pdf(out_pdf)
