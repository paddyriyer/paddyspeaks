#!/usr/bin/env python3
"""The household half of articles/can-you-really-afford-the-bay-area.html.

Companion to scripts/bay_area_affordability_model.py, which covers the house
itself. This one covers what happens to a family living in it:

    python scripts/bay_area_household_model.py

  * the 2026 tax model (federal, California, payroll)  -> Part IV
  * the annual budget for a family of four             -> Part V
  * what each income level can actually sustain        -> Table 4
  * salary rich vs equity rich                         -> Part VI
  * the "life hits hard" stress test                   -> Part IX
  * years of financial freedom                         -> Part XI

Prints only; it never touches the site. The article's tables are static HTML, so
if you change an assumption here you must edit them by hand to match.

The tax model is a MODEL. It ignores itemised deductions, AMT, capital gains,
state credits beyond the exemption credits, and the very different treatment of
equity compensation. It is right to within a few thousand dollars for a
straightforward W-2 household, which is all the article asks of it.
It is not tax advice.
"""
from __future__ import annotations


def pmt(principal: float, rate_pct: float, years: int = 30) -> float:
    i = rate_pct / 100 / 12
    n = years * 12
    return principal * i / (1 - (1 + i) ** -n) if i else principal / n


def m(x: float) -> str:
    return f"${x:,.0f}"


# ------------------------------------------------------------- 2026 taxes ----
# FACT: IRS Rev. Proc. 2025-32 (2026 inflation adjustments), SSA 2026 wage base,
# California EDD 2026 SDI rate. California brackets are approximate and indexed.
FED_BRACKETS = [(24_800, .10), (100_800, .12), (211_100, .22), (403_550, .24),
                (512_450, .32), (768_700, .35), (float("inf"), .37)]
FED_STD_DEDUCTION = 32_200
CHILD_TAX_CREDIT = 2_200          # per qualifying child
CTC_PHASEOUT_MFJ = 400_000        # $50 lost per $1,000 over

CA_BRACKETS = [(21_512, .01), (50_998, .02), (80_490, .04), (111_732, .06),
               (141_212, .08), (721_318, .093), (865_574, .103),
               (1_442_628, .113), (float("inf"), .123)]
CA_STD_DEDUCTION = 11_500
CA_EXEMPTION_CREDITS = 1_220      # 2 personal + 2 dependent, approximate
CA_SDI_RATE = .013                # 1.3%, no wage cap since 2024
SS_WAGE_BASE = 184_500
SS_RATE, MEDICARE_RATE, ADDL_MEDICARE_RATE = .062, .0145, .009
ADDL_MEDICARE_THRESHOLD_MFJ = 250_000

RATE_2026 = 6.71                  # FACT: Freddie Mac PMMS, 3 September 2026
PROPERTY_TAX_RATE = .0125         # MODEL: 1% Prop 13 base + ~0.25% local bonds


def _bracket_tax(taxable: float, table) -> float:
    tax, prev = 0.0, 0.0
    for cap, rate in table:
        if taxable <= prev:
            break
        tax += (min(taxable, cap) - prev) * rate
        prev = cap
    return tax


def taxes(gross: float, children: int = 2, deferral: float = 0.0) -> dict:
    """Married filing jointly, California, W-2 wages, standard deduction."""
    federal_taxable = max(0.0, gross - deferral - FED_STD_DEDUCTION)
    federal = _bracket_tax(federal_taxable, FED_BRACKETS)

    credit = CHILD_TAX_CREDIT * children
    magi = gross - deferral
    if magi > CTC_PHASEOUT_MFJ:
        credit = max(0.0, credit - 50 * -(-(magi - CTC_PHASEOUT_MFJ) // 1000))
    federal = max(0.0, federal - credit)

    social_security = min(gross, SS_WAGE_BASE) * SS_RATE
    medicare = gross * MEDICARE_RATE + \
        max(0.0, gross - ADDL_MEDICARE_THRESHOLD_MFJ) * ADDL_MEDICARE_RATE
    sdi = gross * CA_SDI_RATE

    ca_taxable = max(0.0, gross - deferral - CA_STD_DEDUCTION)
    california = max(0.0, _bracket_tax(ca_taxable, CA_BRACKETS) - CA_EXEMPTION_CREDITS)
    if ca_taxable > 1_000_000:                       # mental health services surcharge
        california += (ca_taxable - 1_000_000) * .01

    total = federal + california + social_security + medicare + sdi
    return dict(federal=federal, california=california, social_security=social_security,
                medicare=medicare, sdi=sdi, total=total,
                net=gross - deferral - total, deferral=deferral)


# ------------------------------------------------------ Part V: the budget ----
# MODEL: illustrative ranges, not survey medians. Anchored on published figures
# where they exist (KFF worker contribution for family cover, $6,850 in 2025).
# Excludes mortgage P&I and property tax, which track whichever house you bought.
BUDGET_TOTALS = {           # lean, typical, comfortable
    "Housing (non-mortgage)":   (15_340,  26_850,  41_730),
    "Transportation":           (10_850,  21_600,  36_900),
    "Food":                     (16_200,  25_400,  38_400),
    "Healthcare":               (10_450,  17_000,  26_800),
    "Children (school age)":    (11_100,  35_500,  80_700),
    "Family and obligation":     (3_800,  18_300,  54_000),
    "Lifestyle":                 (8_000,  20_000,  45_800),
    "The future (saving)":      (35_500,  80_000, 162_000),
}
LEAN, TYPICAL, COMFORTABLE = (sum(v[i] for v in BUDGET_TOTALS.values()) for i in range(3))
LEAN_SPEND = LEAN - BUDGET_TOTALS["The future (saving)"][0]   # zero saving at all

INCOMES = (120_000, 200_000, 300_000, 400_000, 500_000, 700_000)
HOUSING_CHOICES = [("Rent a 3-bed ($4,200/mo)", None),
                   ("Buy $1.4M townhouse", 1_400_000),
                   ("Buy $1.8M 3-bed", 1_800_000),
                   ("Buy $2.3M 4-bed", 2_300_000)]


def annual_housing(price: float | None, down_pct: float = .20,
                   rate: float = RATE_2026, pi_and_tax_only: bool = True) -> float:
    if price is None:
        return 4_200 * 12 + 300                       # rent plus renters insurance
    cost = pmt(price * (1 - down_pct), rate) * 12 + price * PROPERTY_TAX_RATE
    if not pi_and_tax_only:
        cost += 2_600 + 9_000                         # insurance + maintenance
    return cost


def verdict(residual: float) -> str:
    if residual >= TYPICAL:      return "TYPICAL LIFE"
    if residual >= LEAN:         return "LEAN + SAVING"
    if residual >= LEAN_SPEND:   return "LEAN, NO SAVING"
    if residual > 0:             return "SHORT"
    return "IMPOSSIBLE"


def report_taxes_and_scenarios():
    print("=" * 116)
    print("2026 TAX MODEL -- married filing jointly, two children, California, standard deduction")
    print("=" * 116)
    print(f"{'Gross':>10}{'Federal':>11}{'CA':>10}{'SocSec':>10}{'Medicare':>10}"
          f"{'SDI':>9}{'All tax':>11}{'Eff':>7}{'Take-home':>12}")
    for g in INCOMES + (250_000,):
        t = taxes(g)
        print(f"{m(g):>10}{m(t['federal']):>11}{m(t['california']):>10}"
              f"{m(t['social_security']):>10}{m(t['medicare']):>10}{m(t['sdi']):>9}"
              f"{m(t['total']):>11}{t['total']/g*100:>6.1f}%{m(t['net']):>12}")

    print("\n" + "=" * 116)
    print("PART IV -- THE $200,000 PARADOX (buying the $2.3M representative house)")
    print("=" * 116)
    t = taxes(200_000)
    # Same line items as the article's Part IV waterfall: P&I, property tax,
    # insurance of $2,200, maintenance of $9,030 and a $6,000 major-systems reserve.
    full = (pmt(1_840_000, RATE_2026) * 12 + 2_300_000 * PROPERTY_TAX_RATE
            + 2_200 + 9_030 + 6_000)
    print(f"  take-home {m(t['net'])} ({t['net']/200_000*100:.0f}% of gross); "
          f"all-in housing {m(full)}")
    print(f"  left after housing {m(t['net'] - full)}  "
          f"-- housing is {full/200_000*100:.0f}% of gross, {full/t['net']*100:.0f}% of take-home")
    dti_ceiling = 200_000 * .43 / 12
    actual = (pmt(1_840_000, RATE_2026) * 12 + 28_750 + 2_200) / 12
    print(f"  a 43% back-end DTI allows {m(dti_ceiling)}/mo; PITI here is {m(actual)}/mo "
          f"({actual/dti_ceiling*100:.0f}% of the ceiling)")

    print("\n" + "=" * 116)
    print(f"TABLE 4 -- what is left after tax and housing")
    print(f"LEAN {m(LEAN)} | TYPICAL {m(TYPICAL)} | COMFORTABLE {m(COMFORTABLE)} "
          f"| lean spending with zero saving {m(LEAN_SPEND)}")
    print("=" * 116)
    for g in INCOMES:
        t = taxes(g)
        print(f"\n  GROSS {m(g)}  tax {m(t['total'])} ({t['total']/g*100:.0f}%)  "
              f"take-home {m(t['net'])}")
        for label, price in HOUSING_CHOICES:
            h = annual_housing(price)
            left = t['net'] - h
            print(f"     {label:<26}{m(h):>11}/yr  left {m(left):>11}  ->  {verdict(left)}")

    print("\n  Maximum purchase price at 30% and 35% of gross (P&I + tax + insurance):")
    for g in INCOMES:
        row = []
        for share in (.30, .35):
            budget, lo, hi = g * share, 50_000.0, 9_000_000.0
            for _ in range(200):
                mid = (lo + hi) / 2
                cost = pmt(mid * .8, RATE_2026) * 12 + mid * PROPERTY_TAX_RATE + 2_200
                hi, lo = (mid, lo) if cost > budget else (hi, mid)
            row.append(lo)
        print(f"    {m(g):>10}: 30% -> {m(row[0]):>12}   35% -> {m(row[1]):>12}")


# ------------------------------------------------- Part VI: salary vs equity ----
def report_equity(base=250_000, rsu=150_000, years=6, ret=.05, savings_rate=.12):
    print("\n" + "=" * 116)
    print("PART VI -- SALARY RICH vs EQUITY RICH")
    print("=" * 116)
    a = taxes(base)
    b = taxes(base + rsu)
    a_saves = a['net'] * savings_rate
    b_extra = b['net'] - a['net']
    a_pile = sum(a_saves * (1 + ret) ** i for i in range(years))
    b_pile = sum((a_saves + b_extra) * (1 + ret) ** i for i in range(years))
    print(f"  Both families earn {m(base)} of base salary.")
    print(f"  A saves {savings_rate:.0%} of {m(a['net'])} take-home = {m(a_saves)}/yr "
          f"-> {m(a_pile)} after {years} years")
    print(f"  B also vests {m(rsu)}/yr; incremental after-tax {m(b_extra)}/yr "
          f"({b_extra/rsu*100:.0f}% of grant) -> {m(b_pile)}")
    print(f"  DOWN-PAYMENT GAP: {m(a_pile)} vs {m(b_pile)} = {b_pile/a_pile:.1f}x, "
          f"on identical salaries")
    b_half = taxes(base + rsu * .5)['net'] - a['net']
    b_pile_half = sum((a_saves + b_half) * (1 + ret) ** i for i in range(years))
    print(f"  If the stock halves before vest: {m(b_half)}/yr, pile {m(b_pile_half)} "
          f"-- a {(1 - b_pile_half/b_pile)*100:.0f}% haircut")
    print("\n  Three ways to deploy B's cash, tested against the SALARY alone:")
    for label, price, down in (("maximum house", b_pile / .20, b_pile),
                               ("salary-supportable", 1_600_000, b_pile),
                               ("house + reserve", 1_450_000, 595_455)):
        loan = price - down
        carry = pmt(loan, RATE_2026) * 12 + price * PROPERTY_TAX_RATE + 2_600 + 9_000
        print(f"    {label:<22} price {m(price):>11}  down {m(down):>9}  "
              f"P&I {m(pmt(loan, RATE_2026)):>8}/mo  carry {carry/base*100:>4.0f}% of salary  "
              f"cash left {m(b_pile - down)}")


# ------------------------------------------------- Part IX: the stress test ----
# SCENARIO, all at once: the smaller income (40% of salary) stops for 18 months,
# RSUs halve, a $30,000 home repair and a $20,000 medical bill land, and the
# equity portfolio falls 30% at exactly the wrong moment.
SHOCK_MONTHS, SHOCK_REPAIR, SHOCK_MEDICAL = 18, 30_000, 20_000
SHOCK_SALARY_KEPT, SHOCK_RSU_KEPT, SHOCK_EQUITY_KEPT = .60, .50, .70

HOUSEHOLDS = [
    # label, salary, rsu, price, loan, rate, cash, taxable, retirement, other essentials
    ("A - $200K, renting",           200_000,       0,         0,         0, 0.00,  40_000,       0, 180_000,  92_000),
    ("B - $300K, $1.4M bought 2022", 300_000,       0, 1_400_000, 1_050_000, 5.00,  60_000,  25_000, 260_000,  98_000),
    ("C - $400K, $1.8M bought 2024", 300_000, 100_000, 1_800_000, 1_440_000, 6.50, 120_000,  60_000, 340_000, 120_000),
    ("D - $500K, $2.3M bought 2026", 350_000, 150_000, 2_300_000, 1_840_000, 6.71, 150_000, 250_000, 420_000, 140_000),
    ("E - $700K, $3.0M bought 2026", 400_000, 300_000, 3_000_000, 2_250_000, 6.71, 300_000, 700_000, 700_000, 165_000),
]
RENT_ANNUAL = 50_700


def resilience(gap, reserves, retirement, annual_burn):
    if gap <= 0:                                   return "GREEN"
    if reserves - gap >= annual_burn * 0.5:        return "GREEN"
    if reserves >= gap:                            return "YELLOW"
    if reserves + retirement * 0.6 >= gap:         return "ORANGE"
    return "RED"


def report_stress():
    print("\n" + "=" * 116)
    print("PART IX -- THE 'LIFE HITS HARD' STRESS TEST")
    print(f"  smaller income gone {SHOCK_MONTHS} months | RSUs -50% | {m(SHOCK_REPAIR)} repair "
          f"| {m(SHOCK_MEDICAL)} medical | portfolio -30%")
    print("=" * 116)
    for (name, salary, rsu, price, loan, rate, cash, taxable, retirement, other) in HOUSEHOLDS:
        housing = (pmt(loan, rate) * 12 + price * PROPERTY_TAX_RATE + 2_600 + 9_000
                   if price else RENT_ANNUAL)
        burn = housing + other
        need = burn * (SHOCK_MONTHS / 12) + SHOCK_REPAIR + SHOCK_MEDICAL
        income = taxes(salary * SHOCK_SALARY_KEPT + rsu * SHOCK_RSU_KEPT)['net'] * (SHOCK_MONTHS / 12)
        gap = need - income
        reserves = cash + taxable * SHOCK_EQUITY_KEPT
        print(f"\n  {name}   gross {m(salary + rsu)}")
        print(f"     housing {m(housing)}  essential burn {m(burn)}/yr ({m(burn/12)}/mo)")
        print(f"     needs {m(need)} over {SHOCK_MONTHS} months, earns {m(income)} -> "
              f"CASH GAP {m(gap)}")
        print(f"     reserves after the fall {m(reserves)}  "
              f"(cash alone covers {cash/(burn/12):.1f} months)")
        print(f"     >>> {resilience(gap, reserves, retirement, burn)}")


# ------------------------------ Part XI: years of financial freedom ----
def years_of_freedom(label, comp, price, mortgage, rate, cash, taxable,
                     retirement, cars, other_essentials):
    """Accessible assets divided by essential burn. Home equity and retirement
    accounts are deliberately excluded from 'accessible' -- you cannot spend the
    house without leaving it, and retirement costs tax plus a penalty."""
    pi = pmt(mortgage, rate) * 12
    housing = pi + price * PROPERTY_TAX_RATE + 2_600 + 9_000
    burn = housing + cars + other_essentials
    equity = price - mortgage
    net_worth = equity + cash + taxable + retirement
    accessible = cash + taxable
    floor = burn - other_essentials * .35
    print(f"\n  {label}: comp {m(comp)}  house {m(price)}  mortgage {m(mortgage)} @ {rate}%")
    print(f"     net worth {m(net_worth)}  (home equity {m(equity)}, retirement {m(retirement)})")
    print(f"     all-in housing {m(housing)}/yr; ESSENTIAL BURN {m(burn)}/yr ({m(burn/12)}/mo)")
    print(f"     accessible today {m(accessible)}")
    print(f"     YEARS OF FINANCIAL FREEDOM  {accessible/burn:.1f}  "
          f"({accessible/burn*12:.0f} months)")
    print(f"       cutting to a floor of {m(floor)}/yr: {accessible/floor:.1f} years")
    print(f"       including retirement after tax and penalty: "
          f"{(accessible + retirement*.65)/burn:.1f} years")
    return net_worth, accessible / burn, burn


def report_freedom():
    print("\n" + "=" * 116)
    print("PART XI -- WHO IS ACTUALLY RICHER? YEARS OF FINANCIAL FREEDOM")
    print("=" * 116)
    nw_a, yff_a, burn_a = years_of_freedom(
        "Household A", 600_000, 3_000_000, 1_800_000, 6.5, 150_000, 350_000, 1_500_000,
        2_400 * 12, 150_000)
    nw_b, yff_b, burn_b = years_of_freedom(
        "Household B", 300_000, 1_400_000, 400_000, 4.0, 150_000, 1_450_000, 700_000,
        500 * 12, 95_000)
    print(f"\n  Net worth {m(nw_a)} vs {m(nw_b)} -- a difference of "
          f"{abs(nw_a-nw_b)/nw_b*100:.0f}%")
    print(f"  Freedom {yff_a:.1f} years vs {yff_b:.1f} years -- a difference of "
          f"{yff_b/yff_a:.1f}x")
    print(f"  A earns {600_000/300_000:.0f}x B's income and carries {burn_a/burn_b:.1f}x "
          f"B's essential burn.")


if __name__ == "__main__":
    report_taxes_and_scenarios()
    report_equity()
    report_stress()
    report_freedom()
