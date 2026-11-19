# Ideas for future tools (Ezra, 18 Nov 2026)

Already listed as "Coming soon" on the site: reverse DCF, red flags, moat and management scorecard.

1. **ROIC.** Return on invested capital from the annual report.
2. **Reinvestment rate.** How much of operating profit goes back into the business; pairs with ROIC (growth = reinvestment rate × ROIC).
3. **Graham formula / Graham number** (checked against The Intelligent Investor, revised 1973 ed. with Zweig's commentary):
   - Growth formula, ch. 11 ("Capitalization Rates for Growth Stocks", p. 295): Value = current (normal) earnings × (8.5 + 2 × expected annual growth rate), growth over the next 7-10 years. Table 11-4 gives the multipliers; Table 11-5 does the reverse (growth implied by the price). Graham's warnings: above ~8% growth there's no realistic way to value it; illustrative only.
   - The × 4.4 ÷ Y bond-yield version is NOT in the book: Graham added it in "The Decade 1965-1974: Its Significance for Financial Analysts" (The Renaissance of Value, 1974/75). Y = yield on 20-year AAA corporate bonds.
   - "Graham number" is not a term in the book: it comes from ch. 14, defensive investor criteria 6-7 (P/E ≤ 15 on 3-year average earnings, P/B ≤ 1.5, or their product ≤ 22.5). √(22.5 × EPS × book value per share) is the highest price that passes. Could ship with the other 5 defensive criteria as a checklist.
4. **Beneish M-Score.** Earnings manipulation screen (8 ratios). Fits with the red-flags tool.
5. **Altman Z-Score.** Bankruptcy risk (original manufacturing version plus the non-manufacturing Z'').
6. **Sum-of-the-parts.** Simple version for retail investors: each segment × a multiple, plus investments, minus net debt and capitalized overhead.
7. **Reverse DCF.** Simple version for retail investors: the growth the price assumes.

8. **Peter Lynch's formula (PEG and dividend-adjusted).** One Up on Wall Street (1989), ch. 13 "Some Famous Numbers".
   - Rule: a fairly priced stock has a P/E equal to its earnings growth rate. PEG = P/E ÷ growth (around 1 fair; Lynch: half the growth rate is very attractive, twice is very unattractive).
   - Refinement with dividends: (long-term growth rate + dividend yield) ÷ P/E. Below 1 poor, 1.5 okay, 2 or better is what you want. Book example: 15% growth, 3% dividend, P/E 6 → 3.
   - Show both ratios and say which way is "good" (PEG low is good; Lynch's ratio high is good). Helper: EPS growth from 5 years of EPS. Caveat: not for cyclicals or very high growth rates.

9. **Pabrai's Dhandho bet.** The Dhandho Investor (2007), ch. 10 (Kelly Formula) and ch. 7 (simple intrinsic value).
   - 2-4 scenarios (probability × outcome per $1) → expected value, expected gain, worst-case loss ("heads I win, tails I don't lose much").
   - Kelly: edge ÷ odds = fraction of the portfolio. Pabrai's version divides by the total payout; standard Kelly uses net odds, f = (bp − q)/b. Show both. Book examples: coin toss ($2 / −$1) → 25%; 80% win $21, 10% win $7.50, 10% lose $1 → edge $17.45 / $21.
   - Show Kelly as the ceiling and a prudent size next to it (Pabrai Funds put 10% in Stewart Enterprises when Kelly said almost everything).
   - Extra: his sell rule (sell above 90% of intrinsic value if there's a better use of the money; at 100% regardless).
   - Upload the book before building, to check the examples.

Not for the site: Acquirer's Multiple, Magic Formula and Martin Whitman screens. Ezra will run them himself, sort the results into monitors (Value Line / Manual of Ideas style) and publish them for paid subscribers of the newsletter.

10. **Take the market's temperature (Howard Marks).** Mastering the Market Cycle (2018), the "taking the temperature" checklist.
   - Free tool: Marks's pairs (economy vibrant/sluggish, lenders eager/reticent, investors optimistic/pessimistic, issuance quality, etc.), each scored −2 to +2 by the user → cold / cool / neutral / warm / hot, plus the posture for a quality investor (how demanding to be on margin of safety; never buy/sell advice). Shareable on X.
   - Box below: "This month's reading: [X]. The full report, with the data behind it, is for paid subscribers." Impersonal voice. One line in tools.yaml that Ezra updates monthly.
   - The monthly Market Temperature report itself (data, indicators, credit cycle, posture) stays paid.
   - Upload the book before building, to take Marks's exact pairs (paraphrased).

11. **What to pay for quality (The Compounders).** Oddbjørn Dybvad, Kjetil Nyland and Adnan Hadziefendic, The Compounders: From Small Acquisitions to Giant Shareholder Returns (REQ Capital). Same matrix in REQ's 1H 2021 investor letter.
   - Max P/E you can pay today and still earn a target return (8% default) over a horizon (20 years default), given ROIC/ROE and reinvestment rate, plus an exit P/E.
   - Matrix: ROIC rows × reinvestment-rate columns, colored; mark the company's current P/E. Reverse: return at today's P/E.
   - REQ letter example: ROE 20%, reinvestment ~73% → fair P/E around 45.
   - Caveat on the page: only holds if incremental ROIC stays at or above today's ROIC; read with the ROIIC tool.
   - Need the chapter or photos of the matrix to confirm the assumptions (exit P/E, dividends from what isn't reinvested) before building.

12. **Fisher's 15 points (scorecard, complement to the moat and management scorecard).** Philip Fisher, Common Stocks and Uncommon Profits and Other Writings, ch. 3.
   - Each of the 15 points as a question (paraphrased), answered yes / partly / no, with a box for the evidence (scuttlebutt: customers, suppliers, competitors, former employees). Ends with the points met and the gaps; no pass/fail (Fisher says a great company can miss a few).
   - Add the three reasons to sell, and the four dimensions of Conservative Investors Sleep Well (same edition).
   - Separate tool, linked with the moat and management scorecard. Paid version: the management-assessment skill.
   - Upload the book before building, to paraphrase the points faithfully.

13. **Montier's C-Score.** James Montier, "Cooking the books, or, more sailing under the black flag" (Mind Matters, SocGen, 30 June 2008); also ch. 25 of Value Investing: Tools and Techniques for Intelligent Investment.
   - Six yes/no flags from two years of statements: growing gap between net income and operating cash flow; rising days sales outstanding; rising days of inventory; other current assets rising vs revenue; depreciation falling vs gross PP&E; high total asset growth (often >10%). Score 0 (no evidence) to 6.
   - Montier found it adds more combined with price-to-sales above 2. Could live with Beneish in the red-flags tool.
   - Need the paper or the book chapter to confirm the definitions.

14. **Keynes's beauty contest (behavioral, community).** Pick a number 0-100; the winner is closest to 2/3 of the average. Montier uses it to show markets are about guessing what others think.
   - Uses the save-to-sheet system. Ezra publishes the monthly average, winning number and distribution in the newsletter and on X.
