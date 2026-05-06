from __future__ import annotations
MATH_DOMAIN_SKILLS = {
    "Algebra": [
        "Linear equations in one variable",
        "Linear functions",
        "Linear equations in two variables",
        "Systems of two linear equations in two variables",
        "Linear inequalities in one or two variables",
    ],
    "Advanced Math": [
        "Equivalent expressions",
        "Nonlinear equations in one variable and systems of equations in two variables",
        "Nonlinear functions",
    ],
    "Problem-Solving and Data Analysis": [
        "Ratios, rates, proportional relationships, and units",
        "Percentages",
        "One-variable data: Distributions and measures of center and spread",
        "Two-variable data: Models and scatterplots",
        "Probability and conditional probability",
        "Inference from sample statistics and margin of error",
        "Evaluating statistical claims: Observational studies and experiments",
    ],
    "Geometry and Trigonometry": [
        "Area and volume",
        "Lines, angles, and triangles",
        "Right triangles and trigonometry",
        "Circles",
    ],
}

ENGLISH_DOMAIN_SKILLS = {
    "Craft and Structure": [
        "Cross-Text Connections",
        "Text Structure and Purpose",
        "Words in Context",
    ],
    "Expression of Ideas": [
        "Rhetorical Synthesis",
        "Transitions",
    ],
    "Information and Ideas": [
        "Central Ideas and Details",
        "Command of Evidence",
        "Inferences",
    ],
    "Standard English Conventions": [
        "Boundaries",
        "Form, Structure, and Sense",
    ],
}

MATH_SKILL_ALIASES = {
    "linear equations in one variable": "Linear equations in one variable",
    "linear equations in 1 variable": "Linear equations in one variable",
    "linear functions": "Linear functions",
    "linear equations in two variables": "Linear equations in two variables",
    "linear equations in 2 variables": "Linear equations in two variables",
    "systems of linear equations": "Systems of two linear equations in two variables",
    "systems of two linear equations": "Systems of two linear equations in two variables",
    "systems of two linear equations in two variables": "Systems of two linear equations in two variables",
    "linear inequalities": "Linear inequalities in one or two variables",
    "linear inequalities in one or two variables": "Linear inequalities in one or two variables",
    "linear inequalities in 1 or 2 variables": "Linear inequalities in one or two variables",
    "equivalent expressions": "Equivalent expressions",
    "nonlinear equations and systems": "Nonlinear equations in one variable and systems of equations in two variables",
    "nonlinear equations in one variable and systems of equations in two variables": "Nonlinear equations in one variable and systems of equations in two variables",
    "nonlinear equations in 1 variable and systems of equations in 2 variables": "Nonlinear equations in one variable and systems of equations in two variables",
    "nonlinear functions": "Nonlinear functions",
    "ratios, rates, proportions, and units": "Ratios, rates, proportional relationships, and units",
    "ratios, rates, proportional relationships, and units": "Ratios, rates, proportional relationships, and units",
    "ratios, rates, and proportional relationships": "Ratios, rates, proportional relationships, and units",
    "percentages": "Percentages",
    "one-variable data": "One-variable data: Distributions and measures of center and spread",
    "one-variable data: distributions and measures of center and spread": "One-variable data: Distributions and measures of center and spread",
    "two-variable data": "Two-variable data: Models and scatterplots",
    "two-variable data: models and scatterplots": "Two-variable data: Models and scatterplots",
    "probability": "Probability and conditional probability",
    "probability and conditional probability": "Probability and conditional probability",
    "sample statistics and margin of error": "Inference from sample statistics and margin of error",
    "inference from sample statistics and margin of error": "Inference from sample statistics and margin of error",
    "evaluating statistical claims": "Evaluating statistical claims: Observational studies and experiments",
    "evaluating statistical claims: observational studies and experiments": "Evaluating statistical claims: Observational studies and experiments",
    "area and volume": "Area and volume",
    "lines, angles, and triangles": "Lines, angles, and triangles",
    "right triangles and trigonometry": "Right triangles and trigonometry",
    "circles": "Circles",
    # CB older taxonomy aliases
    "heart of algebra": None,  # domain-level, not skill
    "passport to advanced math": None,
    "problem solving and data analysis": None,
    "additional topics in math": None,
}

ENGLISH_SKILL_ALIASES = {
    "cross-text connections": "Cross-Text Connections",
    "text structure and purpose": "Text Structure and Purpose",
    "words in context": "Words in Context",
    "rhetorical synthesis": "Rhetorical Synthesis",
    "transitions": "Transitions",
    "central ideas and details": "Central Ideas and Details",
    "command of evidence": "Command of Evidence",
    "command of evidence (textual)": "Command of Evidence",
    "command of evidence (quantitative)": "Command of Evidence",
    "command of evidence - textual": "Command of Evidence",
    "command of evidence - quantitative": "Command of Evidence",
    "inferences": "Inferences",
    "boundaries": "Boundaries",
    "form, structure, and sense": "Form, Structure, and Sense",
}

MATH_DOMAIN_ALIASES = {
    "algebra": "Algebra",
    "advanced math": "Advanced Math",
    "problem-solving and data analysis": "Problem-Solving and Data Analysis",
    "problem solving and data analysis": "Problem-Solving and Data Analysis",
    "geometry and trigonometry": "Geometry and Trigonometry",
    # CB older names
    "heart of algebra": "Algebra",
    "passport to advanced math": "Advanced Math",
    "additional topics in math": "Geometry and Trigonometry",
}

ENGLISH_DOMAIN_ALIASES = {
    "craft and structure": "Craft and Structure",
    "expression of ideas": "Expression of Ideas",
    "information and ideas": "Information and Ideas",
    "standard english conventions": "Standard English Conventions",
}


def normalize_math_skill(raw):
    return MATH_SKILL_ALIASES.get(raw.strip().lower())


def normalize_english_skill(raw):
    return ENGLISH_SKILL_ALIASES.get(raw.strip().lower())


def normalize_math_domain(raw):
    return MATH_DOMAIN_ALIASES.get(raw.strip().lower())


def normalize_english_domain(raw):
    return ENGLISH_DOMAIN_ALIASES.get(raw.strip().lower())


def get_domain_for_math_skill(skill: str) -> str:
    for domain, skills in MATH_DOMAIN_SKILLS.items():
        if skill in skills:
            return domain
    return "Algebra"


def get_domain_for_english_skill(skill: str) -> str:
    for domain, skills in ENGLISH_DOMAIN_SKILLS.items():
        if skill in skills:
            return domain
    return "Information and Ideas"
