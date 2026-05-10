export default {
  ...require('./id').default,
  common: {
    ...require('./id').default.common,
    next: "Seterusnya", // "Next" in Malay is usually "Seterusnya" vs "Selanjutnya" in ID, but close enough. Let's be precise.
  },
  onboarding: {
    step1of4: "Langkah 1 daripada 4",
    step2of4: "Langkah 2 daripada 4",
    step3of4: "Langkah 3 daripada 4",
    step4of4: "Langkah 4 daripada 4",
    chooseLanguage: "Pilih Bahasa Anda",
    chooseLanguageDesc: "Pilih bahasa kegemaran anda. Anda boleh menukarnya kemudian dalam tetapan.",
    chooseCurrency: "Pilih Mata Wang Anda",
    chooseCurrencyDesc: "Pilih mata wang kegemaran anda untuk mengesan perbelanjaan. Semua jumlah akan dipaparkan dalam mata wang ini.",
    currentBalance: "Baki Semasa",
    currentBalanceDesc: "Masukkan jumlah baki semasa anda untuk semua akaun. Ini akan menjadi titik permulaan anda.",
    balanceSkip: "Anda boleh melangkau ini dan menambahnya kemudian sebagai transaksi \"Pendapatan\".",
    choosePlan: "Pilih Pelan Anda",
    choosePlanDesc: "Mula dengan percubaan percuma atau langgan untuk membuka kunci semua ciri.",
    loadingPlans: "Memuatkan pelan...",
    starting: "Memulakan...",
    startFreeTrial: "Mula Percubaan Percuma",
    subscribe: "Langgan",
    unableToStartTrial: "Tidak dapat memulakan percubaan",
    purchaseFailed: "Pembelian gagal",
    somethingWrong: "Sesuatu tidak kena",
  },
};
