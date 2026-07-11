from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output" / "pdf"
PUBLIC_DIR = ROOT / "public" / "downloads"

NAVY = colors.HexColor("#102136")
COBALT = colors.HexColor("#2864DC")
SKY = colors.HexColor("#EAF2FF")
PALE = colors.HexColor("#F6F9FD")
MUTED = colors.HexColor("#52657A")
LINE = colors.HexColor("#D8E2EE")
GREEN = colors.HexColor("#167A58")
AMBER = colors.HexColor("#A15C00")
WHITE = colors.white


styles = getSampleStyleSheet()
TITLE = ParagraphStyle(
    "AssetTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=24,
    leading=27,
    textColor=NAVY,
    alignment=TA_LEFT,
    spaceAfter=7,
)
SUBTITLE = ParagraphStyle(
    "AssetSubtitle",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=10.5,
    leading=15,
    textColor=MUTED,
    spaceAfter=14,
)
H2 = ParagraphStyle(
    "AssetH2",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=14,
    leading=17,
    textColor=NAVY,
    spaceBefore=8,
    spaceAfter=6,
)
H3 = ParagraphStyle(
    "AssetH3",
    parent=styles["Heading3"],
    fontName="Helvetica-Bold",
    fontSize=10.5,
    leading=13,
    textColor=COBALT,
    spaceBefore=5,
    spaceAfter=3,
)
BODY = ParagraphStyle(
    "AssetBody",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9.2,
    leading=13.2,
    textColor=NAVY,
    spaceAfter=5,
)
SMALL = ParagraphStyle(
    "AssetSmall",
    parent=BODY,
    fontSize=7.5,
    leading=10.2,
    textColor=MUTED,
)
TABLE_HEAD = ParagraphStyle(
    "AssetTableHead",
    parent=BODY,
    fontName="Helvetica-Bold",
    fontSize=8.2,
    leading=10.5,
    textColor=WHITE,
    alignment=TA_LEFT,
)
TABLE_BODY = ParagraphStyle(
    "AssetTableBody",
    parent=BODY,
    fontSize=7.8,
    leading=10.4,
    spaceAfter=0,
)
CALLOUT = ParagraphStyle(
    "AssetCallout",
    parent=BODY,
    fontName="Helvetica-Bold",
    fontSize=9.2,
    leading=13,
    textColor=NAVY,
    alignment=TA_CENTER,
)


def p(text, style=BODY):
    return Paragraph(text, style)


def bullet(text):
    return Paragraph(f"<font color='#2864DC'>&#8226;</font> {text}", BODY)


def source(label, url):
    return p(f"<b>{label}:</b> <link href='{url}' color='#2864DC'>{url}</link>", SMALL)


def table(headers, rows, widths, repeat_rows=1):
    data = [[p(cell, TABLE_HEAD) for cell in headers]]
    data.extend([[p(cell, TABLE_BODY) for cell in row] for row in rows])
    result = Table(data, colWidths=widths, repeatRows=repeat_rows, hAlign="LEFT")
    result.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), COBALT),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
                ("LINEBELOW", (0, 0), (-1, -1), 0.45, LINE),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ]
        )
    )
    return result


def callout(text, color=SKY):
    result = Table([[p(text, CALLOUT)]], colWidths=[7.1 * inch])
    result.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), color),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 11),
                ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    return result


def page_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(0.7 * inch, 10.55 * inch, "1600.now")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(7.8 * inch, 10.55 * inch, "Free Digital SAT practice and tools")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(0.7 * inch, 10.42 * inch, 7.8 * inch, 10.42 * inch)
    canvas.line(0.7 * inch, 0.55 * inch, 7.8 * inch, 0.55 * inch)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.7 * inch, 0.36 * inch, "1600.now - educational resource; not affiliated with College Board")
    canvas.drawRightString(7.8 * inch, 0.36 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf(filename, story, title, subject):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / filename
    doc = BaseDocTemplate(
        str(output),
        pagesize=letter,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.72 * inch,
        title=title,
        subject=subject,
        author="1600.now",
        creator="1600.now",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="content")
    doc.addPageTemplates([PageTemplate(id="asset", frames=[frame], onPage=page_header_footer)])
    doc.build(story)
    (PUBLIC_DIR / filename).write_bytes(output.read_bytes())
    return output


def desmos_story():
    return [
        p("Digital SAT Desmos Reference Sheet", TITLE),
        p("A calculator decision guide with exact inputs, high-value shortcuts, and the mistakes that cost time.", SUBTITLE),
        callout("Use Desmos when the graph, table, or intersection removes work. If typing the setup takes longer than solving the equation, stay with algebra."),
        p("The four-step calculator workflow", H2),
        table(
            ["Step", "What to do", "Check before moving on"],
            [
                ["1. Translate", "Turn the prompt into an equation, function, table, or list of points.", "Name the requested value and its unit."],
                ["2. Enter", "Type the mathematical relationship exactly. Use separate lines for separate equations.", "Check signs, exponents, parentheses, and restrictions."],
                ["3. Read", "Use an intersection, intercept, vertex, table value, or regression parameter.", "Confirm whether the question wants x, y, or an expression."],
                ["4. Verify", "Substitute the result or compare it with the answer choices.", "Reject extraneous values and impossible units."],
            ],
            [0.72 * inch, 3.15 * inch, 3.23 * inch],
        ),
        p("High-value moves", H2),
        table(
            ["Question type", "What to enter", "What to read"],
            [
                ["System", "Type both equations on separate lines.", "Intersection; check whether the answer is x, y, or x + y."],
                ["Quadratic roots", "y = ax^2 + bx + c", "The x-intercepts, not the vertex."],
                ["Maximum or minimum", "Type the function and zoom near the turn.", "Vertex x and y answer different questions."],
                ["Function values", "Define f(x)=... and open a table.", "Read f(x) only at the requested inputs."],
                ["Unknown constant", "Enter the equation with the constant as a slider.", "Adjust or test choices until the required condition is true."],
                ["Data model", "Enter points in a table, then type y_1 ~ mx_1 + b.", "Use m and b only when a linear model is requested."],
                ["Domain restriction", "Append braces, such as {0&lt;x&lt;10}.", "Inspect only the interval named in the problem."],
            ],
            [1.38 * inch, 3.45 * inch, 2.27 * inch],
        ),
        Spacer(1, 8),
        KeepTogether(
            [
                p("Three worked setups", H2),
                p("<b>System:</b> For y = 2x + 5 and y = -x + 14, graph both lines. The intersection is (3, 11). If the prompt asks for x + y, report 14 - not 3 or 11.", BODY),
                p("<b>Quadratic:</b> For x^2 - 7x + 10 = 0, graph y = x^2 - 7x + 10. The x-intercepts are 2 and 5. The vertex is not a solution to the equation.", BODY),
                p("<b>Regression:</b> Put paired data in x_1 and y_1, then use y_1 ~ mx_1 + b. Read the model parameters, but do not run regression when the prompt merely asks for the slope between two exact points.", BODY),
            ]
        ),
        KeepTogether(
            [
                p("Time-saving keyboard and input habits", H2),
                table(
                    ["Action", "Shortcut or input"],
                    [
                        ["Exponent", "Type ^, then enter the exponent."],
                        ["Subscript", "Type _, as in x_1 or y_1."],
                        ["Absolute value", "Type abs(expression)."],
                        ["Square root", "Type sqrt(expression)."],
                        ["Fraction", "Use parentheses around the full numerator and denominator."],
                        ["List", "Use brackets, such as [2, 4, 7]."],
                        ["Restriction", "Use braces after the expression, such as y=x^2{0&lt;x&lt;5}."],
                    ],
                    [2.1 * inch, 5.0 * inch],
                ),
            ]
        ),
        p("When Desmos becomes a trap", H2),
        bullet("One-step percentages, ratios, and direct substitutions are usually faster without graphing."),
        bullet("The visible window can hide an intercept or intersection. Zoom or use a table."),
        bullet("A decimal display may not be the exact form the question asks for."),
        bullet("An intersection is not automatically the requested answer. Re-read the final sentence."),
        bullet("A slider is useful only after you identify the condition the constant must satisfy."),
        p("10-minute setup drill", H2),
        table(
            ["Prompt", "Best first move"],
            [
                ["Find where two linear equations have the same output.", "Graph both and inspect the intersection."],
                ["Evaluate f(2), f(7), and f(12).", "Define f(x), then enter those inputs in a table."],
                ["Find the zeros of a quadratic with awkward coefficients.", "Graph the quadratic and read its x-intercepts."],
                ["Find a maximum value over 0 &lt; x &lt; 20.", "Graph with the domain restriction and inspect the vertex."],
                ["Predict y from several measured data points.", "Use a table and the model type requested in the prompt."],
            ],
            [3.4 * inch, 3.7 * inch],
        ),
        p("Practice next", H2),
        callout("Open targeted Desmos practice at https://1600.now/sat-desmos-reference-sheet", colors.HexColor("#EAF8F2")),
        p("Sources", H2),
        source("Desmos keyboard shortcuts", "https://help.desmos.com/hc/en-us/articles/4405966811021-Keyboard-Shortcuts"),
        source("College Board calculator policy", "https://satsuite.collegeboard.org/sat/what-to-bring-do/calculator-policy"),
        p("Reviewed July 2026. Calculator features and testing policies can change; confirm current policy before test day.", SMALL),
    ]


def formula_story():
    return [
        p("Digital SAT Math Formula Chart", TITLE),
        p("Separate what Bluebook provides from what is worth knowing cold, then connect each formula to the question type that uses it.", SUBTITLE),
        callout("A memorized formula only helps when you recognize the structure. Label the quantities and units before substituting."),
        p("Reference information provided in the Math section", H2),
        table(
            ["Topic", "Formula", "Use"],
            [
                ["Circle", "A = pi r^2; C = 2 pi r", "Area or circumference from radius or diameter."],
                ["Rectangle", "A = lw", "Area from length and width."],
                ["Triangle", "A = (1/2)bh", "Area from a perpendicular base and height."],
                ["Right triangle", "a^2 + b^2 = c^2", "Missing side when c is the hypotenuse."],
                ["Special triangles", "30-60-90: x, x sqrt(3), 2x; 45-45-90: x, x, x sqrt(2)", "Exact side ratios."],
                ["Rectangular solid", "V = lwh", "Volume."],
                ["Cylinder", "V = pi r^2 h", "Volume from base area and height."],
                ["Cone", "V = (1/3) pi r^2 h", "Volume."],
                ["Sphere", "V = (4/3) pi r^3", "Volume."],
                ["Angle measure", "360 degrees = 2 pi radians", "Convert degrees and radians."],
            ],
            [1.2 * inch, 3.15 * inch, 2.75 * inch],
        ),
        p("Algebra and Advanced Math worth knowing", H2),
        table(
            ["Pattern", "Formula or form", "Recognition cue"],
            [
                ["Slope", "m = (y_2 - y_1)/(x_2 - x_1)", "Rate of change between two points."],
                ["Line", "y = mx + b", "m is slope; b is the y-intercept."],
                ["Point-slope", "y - y_1 = m(x - x_1)", "A slope and one point are given."],
                ["Quadratic formula", "x = (-b +/- sqrt(b^2 - 4ac))/(2a)", "The quadratic does not factor cleanly."],
                ["Discriminant", "b^2 - 4ac", "Positive: 2 real roots; zero: 1; negative: none."],
                ["Vertex x-value", "x = -b/(2a)", "Axis of symmetry or maximum/minimum input."],
                ["Exponential", "y = a(b)^x", "a is initial value; b is the growth factor."],
                ["Percent change", "(new - old)/old x 100%", "Increase or decrease relative to the original."],
                ["Direct variation", "y = kx", "Constant ratio y/x."],
                ["Inverse variation", "y = k/x", "Constant product xy."],
            ],
            [1.25 * inch, 3.15 * inch, 2.7 * inch],
        ),
        KeepTogether(
            [
                p("Geometry and Trigonometry worth knowing", H2),
                table(
                    ["Pattern", "Formula", "Recognition cue"],
                    [
                        ["Distance", "sqrt((x_2-x_1)^2 + (y_2-y_1)^2)", "Length between coordinate points."],
                        ["Midpoint", "((x_1+x_2)/2, (y_1+y_2)/2)", "Point halfway between endpoints."],
                        ["Arc length", "theta/360 x 2 pi r", "Central angle is in degrees."],
                        ["Sector area", "theta/360 x pi r^2", "Fraction of a circle's area."],
                        ["Circle equation", "(x-h)^2 + (y-k)^2 = r^2", "Center (h,k), radius r."],
                        ["Trig ratios", "sin = opposite/hypotenuse; cos = adjacent/hypotenuse; tan = opposite/adjacent", "Right triangle angle and side relationship."],
                        ["Similar figures", "corresponding sides share one scale factor", "Angles match; lengths scale by k; areas by k^2."],
                    ],
                    [1.25 * inch, 3.25 * inch, 2.6 * inch],
                ),
            ]
        ),
        p("Problem-Solving and Data Analysis", H2),
        table(
            ["Pattern", "Rule", "Common mistake"],
            [
                ["Mean", "sum of values / number of values", "Forgetting frequency when values repeat."],
                ["Weighted mean", "sum(value x weight) / sum(weights)", "Averaging group means without group sizes."],
                ["Probability", "favorable outcomes / total outcomes", "Using an unconditional denominator for a conditional event."],
                ["Density", "mass / volume", "Mixing units before dividing."],
                ["Unit rate", "quantity / 1 unit", "Reporting the reciprocal rate."],
                ["Margin of error", "larger random sample usually means smaller margin of error", "Assuming a larger sample removes bias."],
            ],
            [1.25 * inch, 3.15 * inch, 2.7 * inch],
        ),
        p("Fast decision checklist", H2),
        bullet("What does the answer represent, and what unit should it use?"),
        bullet("Is the formula already provided, or do I need to recognize a standard form?"),
        bullet("Would Desmos graphing, a table, or regression remove algebra steps?"),
        bullet("Does the result fit the scale and constraints in the prompt?"),
        callout("Practice formula-heavy questions at https://1600.now/sat-math-formula-chart", colors.HexColor("#EAF8F2")),
        p("Source", H2),
        source("College Board SAT Math reference information", "https://satsuite.collegeboard.org/sat/whats-on-the-test/math/reference-information"),
        p("Reviewed July 2026. This chart supplements the reference information shown in Bluebook; it is not an official College Board document.", SMALL),
    ]


def checklist_story():
    rows = [
        ["7 days before", "Run Bluebook device check; install updates; confirm admission ticket and test-center details.", "Device starts, Bluebook opens, and exam setup is complete."],
        ["2 days before", "Charge device and backup calculator; confirm route, arrival time, and acceptable ID.", "Logistics are written down and shared with an adult."],
        ["Night before", "Pack ID, charged device, charger, pencils, approved calculator backup, water, and a quiet snack.", "Bag is by the door; alarms are set."],
        ["Test morning", "Eat, arrive early, silence phone, and follow staff instructions.", "You are checked in before the doors close."],
        ["During testing", "Read the last sentence, watch units, flag uncertain items, and return before time expires.", "No answer is left blank without an intentional decision."],
        ["After testing", "Save your memory of difficult skills, then wait for official score release information.", "You have a short review note, not a reconstructed test."],
    ]
    return [
        p("Digital SAT Test-Day Checklist", TITLE),
        p("A one-page logistics and pacing checklist. Confirm current policies in Bluebook and on College Board before your administration.", SUBTITLE),
        table(["When", "Action", "Done when"], rows, [1.05 * inch, 3.9 * inch, 2.15 * inch]),
        p("Pack this", H2),
        table(
            ["Required or essential", "Useful backup"],
            [
                ["Acceptable photo ID; admission ticket details; fully charged approved testing device; device charger.", "Approved calculator; pencils or pens for scratch work; water; quiet snack; simple watch without an alarm."],
            ],
            [3.55 * inch, 3.55 * inch],
        ),
        p("Do not bring or use", H2),
        bullet("Phones, smartwatches, earbuds, or other communication devices during testing unless staff explicitly direct otherwise."),
        bullet("A calculator model or accessory prohibited by current College Board policy."),
        bullet("Notes, reference sheets, or copied test content."),
        p("Three pacing rules", H2),
        bullet("If you cannot choose a path after about 30 seconds, flag the question and keep moving."),
        bullet("Protect time for the final questions, which are not automatically worth more points."),
        bullet("Use the last minute to answer blanks and verify grid-ins, signs, and units."),
        callout("Live countdown and current dates: https://1600.now/sat-test-countdown", colors.HexColor("#EAF8F2")),
        p("Official sources", H2),
        source("What to bring and do", "https://satsuite.collegeboard.org/sat/what-to-bring-do"),
        source("Calculator policy", "https://satsuite.collegeboard.org/sat/what-to-bring-do/calculator-policy"),
        source("Bluebook", "https://bluebook.collegeboard.org/students/sat-weekend"),
        p("Reviewed July 2026. Test-center instructions and College Board policy control if they differ from this checklist.", SMALL),
    ]


def main():
    outputs = [
        build_pdf(
            "sat-desmos-reference-sheet.pdf",
            desmos_story(),
            "Digital SAT Desmos Reference Sheet",
            "Desmos workflows and shortcuts for Digital SAT Math",
        ),
        build_pdf(
            "sat-math-formula-chart.pdf",
            formula_story(),
            "Digital SAT Math Formula Chart",
            "Provided and high-value formulas for Digital SAT Math",
        ),
        build_pdf(
            "sat-test-day-checklist.pdf",
            checklist_story(),
            "Digital SAT Test-Day Checklist",
            "Digital SAT logistics and pacing checklist",
        ),
    ]
    print("\n".join(str(output) for output in outputs))


if __name__ == "__main__":
    main()
