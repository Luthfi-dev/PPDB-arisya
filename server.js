// server.ts
import express from "express";
import path2 from "path";
import fs2 from "fs";
import crypto2 from "crypto";
import { fileURLToPath as fileURLToPath2 } from "url";
import dotenv2 from "dotenv";
import nodemailer from "nodemailer";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

// server/db.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

// src/data/initialData.ts
var INITIAL_BANK_ACCOUNTS = [
  {
    id: "bank-bsi-1",
    bankName: "Bank Syariah Indonesia (BSI)",
    bankCode: "BSI",
    accountNumber: "7109283741",
    accountHolder: "Yayasan Ar-Risalah Aceh",
    branch: "KC Bireuen",
    notes: "Transfer dapat dilakukan melalui BSI Mobile, ATM Bersama, Prima, atau transfer antar-bank.",
    isActive: true,
    isPrimary: true,
    sortOrder: 1
  }
];
var INITIAL_UNITS = [
  {
    id: "TK01",
    name: "TKIT Ar-Risalah Aceh",
    shortName: "TKIT",
    totalQuota: 150,
    filledQuota: 3,
    formFee: 25e4,
    reRegFee: 35e5,
    facilities: ["Sentra Bermain Islami", "Kolam Renang Anak", "Pojok Tahfidz Balita", "Pemeriksaan Tumbuh Kembang"],
    isOpen: true,
    closedNotice: "Pendaftaran untuk unit TKIT Ar-Risalah Aceh saat ini sedang ditutup atau kuota telah terpenuhi.",
    sortOrder: 1
  },
  {
    id: "SD01",
    name: "SDIT Ar-Risalah Aceh",
    shortName: "SDIT",
    totalQuota: 600,
    filledQuota: 4,
    formFee: 3e5,
    reRegFee: 55e5,
    facilities: ["Laboratorium Sains & Robotik", "Masjid Al-Washliyah", "Perpustakaan Digital", "Outbound Area"],
    isOpen: true,
    closedNotice: "Pendaftaran untuk unit SDIT Ar-Risalah Aceh saat ini sedang ditutup atau kuota telah terpenuhi.",
    sortOrder: 2
  },
  {
    id: "SMP01",
    name: "SMPIT Ar-Risalah Aceh (Boarding/Full Day)",
    shortName: "SMPIT",
    totalQuota: 180,
    filledQuota: 3,
    formFee: 35e4,
    reRegFee: 75e5,
    facilities: ["Asrama Ber-AC & Sanitasi Bersih", "Program Tahfidz 15 Juz", "Language Laboratory", "Klinik Siswa 24 Jam"],
    isOpen: true,
    closedNotice: "Pendaftaran untuk unit SMPIT Ar-Risalah Aceh saat ini sedang ditutup atau kuota telah terpenuhi.",
    sortOrder: 3
  },
  {
    id: "SMA01",
    name: "SMAIT Ar-Risalah Aceh (Boarding School)",
    shortName: "SMAIT",
    totalQuota: 120,
    filledQuota: 3,
    formFee: 4e5,
    reRegFee: 85e5,
    facilities: ["Persiapan PTN & Luar Negeri (Timteng/Eropa)", "Tahfidz Al-Qur'an Mutqin 30 Juz", "Sport Center & Lapangan Panahan", "Bimbingan Olimpiade OSN"],
    isOpen: true,
    closedNotice: "Pendaftaran untuk unit SMAIT Ar-Risalah Aceh saat ini sedang ditutup atau kuota telah terpenuhi.",
    sortOrder: 4
  }
];
var INITIAL_STUDENTS = [
  {
    id: "reg-001",
    registrationNumber: "PPDB-2026-TK01-001",
    fullName: "Muhammad Al-Fatih Pratama",
    unit: "TK01",
    gender: "Laki-laki",
    birthPlace: "Banda Aceh",
    birthDate: "2021-04-12",
    address: "Jl. Teuku Nyak Arief No. 45, Syiah Kuala, Banda Aceh",
    parentName: "Rahmat Hidayat, S.T.",
    parentPhone: "081269001234",
    parentJob: "PNS Pemprov Aceh",
    parentIncome: "Rp 7.000.000 - Rp 10.000.000",
    status: "lulus",
    registeredAt: "2026-10-18 09:30",
    documents: {},
    verificationNotes: "Berkas lengkap dan sesuai kriteria usia 5 tahun per Juli 2026.",
    testScore: 88,
    testScheduleId: "sch-001",
    testPublished: true
  },
  {
    id: "reg-002",
    registrationNumber: "PPDB-2026-SD01-042",
    fullName: "Aisyah Humaira Al-Zahra",
    nisn: "0182746192",
    unit: "SD01",
    gender: "Perempuan",
    birthPlace: "Aceh Besar",
    birthDate: "2019-08-20",
    address: "Kompleks Meuligoe Indah Blok B4, Ingin Jaya, Aceh Besar",
    parentName: "Dr. Zulfikar, Sp.A",
    parentPhone: "08116812399",
    parentJob: "Dokter Spesialis",
    parentIncome: "> Rp 15.000.000",
    status: "tes",
    registeredAt: "2026-10-19 11:15",
    documents: {},
    verificationNotes: "Terverifikasi. Dijadwalkan observasi kesiapan sekolah & wawancara orang tua.",
    testScheduleId: "sch-002",
    testPublished: false
  },
  {
    id: "reg-003",
    registrationNumber: "PPDB-2026-SMP01-018",
    fullName: "Sulthan Thariq Al-Ayyubi",
    nisn: "0129482711",
    unit: "SMP01",
    gender: "Laki-laki",
    birthPlace: "Sigli",
    birthDate: "2013-11-05",
    address: "Gampong Lambaro, Kec. Ingin Jaya, Kab. Aceh Besar",
    parentName: "Tgk. Mansur Bakri",
    parentPhone: "085277112233",
    parentJob: "Wiraswasta / Pedagang",
    parentIncome: "Rp 5.000.000 - Rp 7.000.000",
    status: "verifikasi",
    registeredAt: "2026-10-21 14:02",
    documents: {}
  },
  {
    id: "reg-004",
    registrationNumber: "PPDB-2026-SMA01-009",
    fullName: "Fatimah Az-Zahra Munawwarah",
    nisn: "0103948211",
    unit: "SMA01",
    gender: "Perempuan",
    birthPlace: "Banda Aceh",
    birthDate: "2010-02-14",
    address: "Jl. Soekarno-Hatta No. 88, Lampeuneurut, Aceh Besar",
    parentName: "Ir. Bukhari Daud, M.Sc.",
    parentPhone: "081360098877",
    parentJob: "Dosen Universitas Syiah Kuala",
    parentIncome: "Rp 10.000.000 - Rp 15.000.000",
    status: "lulus",
    registeredAt: "2026-10-15 08:45",
    documents: {},
    verificationNotes: "Hafalan Al-Qur'an 7 Juz, nilai tes akademik 92.",
    testScore: 92,
    testScheduleId: "sch-003",
    testPublished: true
  },
  {
    id: "reg-005",
    registrationNumber: "PPDB-2026-SD01-089",
    fullName: "Rayhan Putra Iskandar",
    nisn: "0193847291",
    unit: "SD01",
    gender: "Laki-laki",
    birthPlace: "Lhokseumawe",
    birthDate: "2019-12-01",
    address: "Gampong Peuniti, Baiturrahman, Banda Aceh",
    parentName: "Iskandar Muda",
    parentPhone: "082165449900",
    parentJob: "Karyawan Swasta",
    parentIncome: "Rp 5.000.000 - Rp 7.000.000",
    status: "verifikasi",
    registeredAt: "2026-10-23 16:40",
    documents: {}
  },
  {
    id: "reg-006",
    registrationNumber: "PPDB-2026-SMP01-055",
    fullName: "Cut Sarah Najwa",
    nisn: "0138472910",
    unit: "SMP01",
    gender: "Perempuan",
    birthPlace: "Bireuen",
    birthDate: "2014-01-25",
    address: "Jl. Malahayati No. 12, Baitussalam, Aceh Besar",
    parentName: "Teuku Anwar Syahputra",
    parentPhone: "081267882211",
    parentJob: "Pengusaha Tambak & Pertanian",
    parentIncome: "> Rp 15.000.000",
    status: "tidak_lulus",
    registeredAt: "2026-10-17 10:10",
    documents: {},
    verificationNotes: "Nilai tes bacaan Al-Qur'an dan tes akademik belum memenuhi batas minimum kelulusan SMPIT.",
    testScore: 56,
    testScheduleId: "sch-002",
    testPublished: true
  },
  {
    id: "reg-007",
    registrationNumber: "PPDB-2026-TK01-034",
    fullName: "Khansa Maryam Sabira",
    unit: "TK01",
    gender: "Perempuan",
    birthPlace: "Banda Aceh",
    birthDate: "2021-09-10",
    address: "Jl. Blang Bintang Lama, Tungkop, Aceh Besar",
    parentName: "Muhammad Nasir, S.Pd.I",
    parentPhone: "085361002244",
    parentJob: "Guru Dayah",
    parentIncome: "Rp 3.000.000 - Rp 5.000.000",
    status: "tes",
    registeredAt: "2026-10-22 13:20",
    documents: {},
    testScheduleId: "sch-001",
    testPublished: false
  },
  {
    id: "reg-008",
    registrationNumber: "PPDB-2026-SD01-112",
    fullName: "Ziyad Hafizurrahman",
    nisn: "0192837465",
    unit: "SD01",
    gender: "Laki-laki",
    birthPlace: "Banda Aceh",
    birthDate: "2019-05-18",
    address: "Lorong Cempaka No. 5, Lueng Bata, Banda Aceh",
    parentName: "H. Syamsuddin, M.Ag",
    parentPhone: "08116709823",
    parentJob: "Kemenag Wilayah Aceh",
    parentIncome: "Rp 7.000.000 - Rp 10.000.000",
    status: "lulus",
    registeredAt: "2026-10-14 15:50",
    documents: {},
    verificationNotes: "Lulus dengan nilai tes kesiapan 90. Hafal Juz 30 mutqin.",
    testScore: 90,
    testScheduleId: "sch-002",
    testPublished: true
  },
  {
    id: "reg-009",
    registrationNumber: "PPDB-2026-TK01-050",
    fullName: "Ahmad Hanif Ramadhan",
    unit: "TK01",
    gender: "Laki-laki",
    birthPlace: "Banda Aceh",
    birthDate: "2021-06-01",
    address: "Gampong Lampineung, Syiah Kuala, Banda Aceh",
    parentName: "Dr. M. Ridwan, M.T.",
    parentPhone: "081269112233",
    parentJob: "Dosen Teknik",
    parentIncome: "Rp 10.000.000 - Rp 15.000.000",
    status: "verifikasi",
    registeredAt: "2026-10-24 10:15",
    documents: {}
  },
  {
    id: "reg-010",
    registrationNumber: "PPDB-2026-SD01-150",
    fullName: "Nayla Syafiqah Az-Zahra",
    nisn: "0189384756",
    unit: "SD01",
    gender: "Perempuan",
    birthPlace: "Sigli",
    birthDate: "2019-03-10",
    address: "Gampong Ajuen, Peukan Bada, Aceh Besar",
    parentName: "Saiful Bahri, S.E.",
    parentPhone: "085260998877",
    parentJob: "Perbankan Syariah",
    parentIncome: "Rp 7.000.000 - Rp 10.000.000",
    status: "tes",
    registeredAt: "2026-10-24 14:20",
    documents: {},
    testScheduleId: "sch-002",
    testPublished: false
  },
  {
    id: "reg-011",
    registrationNumber: "PPDB-2026-SMP01-088",
    fullName: "Bilal Ibn Rabah Al-Farisi",
    nisn: "0139482019",
    unit: "SMP01",
    gender: "Laki-laki",
    birthPlace: "Langsa",
    birthDate: "2013-09-19",
    address: "Jl. T. Umar No. 102, Setui, Banda Aceh",
    parentName: "Ust. Hamdani Al-Hafiz",
    parentPhone: "081377665544",
    parentJob: "Guru Tahfidz",
    parentIncome: "Rp 5.000.000 - Rp 7.000.000",
    status: "lulus",
    registeredAt: "2026-10-16 11:30",
    documents: {},
    verificationNotes: "Lulus seleksi asrama. Hafalan 5 Juz Al-Qur'an.",
    testScore: 89,
    testScheduleId: "sch-003",
    testPublished: true
  },
  {
    id: "reg-012",
    registrationNumber: "PPDB-2026-SMA01-025",
    fullName: "Hasan Basri Al-Banjari",
    nisn: "0102938471",
    unit: "SMA01",
    gender: "Laki-laki",
    birthPlace: "Meulaboh",
    birthDate: "2010-07-22",
    address: "Kompleks Syiah Kuala Indah, Banda Aceh",
    parentName: "Tgk. H. Syukri Rahmat",
    parentPhone: "081269334455",
    parentJob: "Wiraswasta",
    parentIncome: "Rp 10.000.000 - Rp 15.000.000",
    status: "tes",
    registeredAt: "2026-10-20 16:10",
    documents: {},
    testScheduleId: "sch-004",
    testPublished: false
  },
  {
    id: "reg-013",
    registrationNumber: "PPDB-2026-SMA01-030",
    fullName: "Zahra Annisa Fitri",
    nisn: "0101928374",
    unit: "SMA01",
    gender: "Perempuan",
    birthPlace: "Banda Aceh",
    birthDate: "2010-05-15",
    address: "Gampong Beurawe, Kuta Alam, Banda Aceh",
    parentName: "Zulkarnain, S.Ag",
    parentPhone: "085277889900",
    parentJob: "PNS Kemenag",
    parentIncome: "Rp 7.000.000 - Rp 10.000.000",
    status: "verifikasi",
    registeredAt: "2026-10-25 08:30",
    documents: {}
  }
];
var INITIAL_PAYMENTS = [
  {
    id: "pay-001",
    registrationId: "reg-001",
    registrationNumber: "PPDB-2026-TK01-001",
    studentName: "Muhammad Al-Fatih Pratama",
    unit: "TK01",
    type: "Formulir",
    amount: 25e4,
    status: "lunas",
    date: "2026-10-18 10:00",
    proofUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop",
    verifiedBy: "bendahara@arrisalahaceh.or.id",
    bankAccount: "BSI (Bank Syariah Indonesia) 7109283741 a.n Yayasan Ar-Risalah Aceh"
  },
  {
    id: "pay-002",
    registrationId: "reg-001",
    registrationNumber: "PPDB-2026-TK01-001",
    studentName: "Muhammad Al-Fatih Pratama",
    unit: "TK01",
    type: "Daftar Ulang",
    amount: 35e5,
    status: "lunas",
    date: "2026-10-20 14:30",
    proofUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop",
    verifiedBy: "bendahara@arrisalahaceh.or.id",
    bankAccount: "BSI (Bank Syariah Indonesia) 7109283741 a.n Yayasan Ar-Risalah Aceh"
  },
  {
    id: "pay-003",
    registrationId: "reg-002",
    registrationNumber: "PPDB-2026-SD01-042",
    studentName: "Aisyah Humaira Al-Zahra",
    unit: "SD01",
    type: "Formulir",
    amount: 3e5,
    status: "lunas",
    date: "2026-10-19 11:45",
    proofUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop",
    verifiedBy: "bendahara@arrisalahaceh.or.id",
    bankAccount: "BSI (Bank Syariah Indonesia) 7109283741 a.n Yayasan Ar-Risalah Aceh"
  },
  {
    id: "pay-004",
    registrationId: "reg-003",
    registrationNumber: "PPDB-2026-SMP01-018",
    studentName: "Sulthan Thariq Al-Ayyubi",
    unit: "SMP01",
    type: "Formulir",
    amount: 35e4,
    status: "verifikasi",
    date: "2026-10-21 14:30",
    proofUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop",
    bankAccount: "BSI (Bank Syariah Indonesia) 7109283741 a.n Yayasan Ar-Risalah Aceh"
  },
  {
    id: "pay-005",
    registrationId: "reg-004",
    registrationNumber: "PPDB-2026-SMA01-009",
    studentName: "Fatimah Az-Zahra Munawwarah",
    unit: "SMA01",
    type: "Formulir",
    amount: 4e5,
    status: "lunas",
    date: "2026-10-15 09:12",
    proofUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop",
    verifiedBy: "bendahara@arrisalahaceh.or.id",
    bankAccount: "BSI (Bank Syariah Indonesia) 7109283741 a.n Yayasan Ar-Risalah Aceh"
  },
  {
    id: "pay-006",
    registrationId: "reg-005",
    registrationNumber: "PPDB-2026-SD01-089",
    studentName: "Rayhan Putra Iskandar",
    unit: "SD01",
    type: "Formulir",
    amount: 3e5,
    status: "pending",
    date: "2026-10-23 17:00",
    proofUrl: "",
    bankAccount: "BSI (Bank Syariah Indonesia) 7109283741 a.n Yayasan Ar-Risalah Aceh"
  }
];
var INITIAL_SCHEDULES = [
  {
    id: "sch-001",
    title: "Observasi Kesiapan Calon Siswa TKIT Gelombang 1",
    unit: "TK01",
    date: "2026-11-05",
    startTime: "08:30",
    endTime: "11:30",
    room: "Ruang Sentra Bermain A & B",
    examiner: "Ustzh. Nurhasanah, S.Pd.I & Tim Psikolog Anak",
    quota: 40,
    filled: 34
  },
  {
    id: "sch-002",
    title: "Tes Pemetaan Akademik & Al-Qur'an SDIT Batch A",
    unit: "SD01",
    date: "2026-11-07",
    startTime: "08:00",
    endTime: "12:00",
    room: "Aula Ibnu Sina & Ruang Kelas 1-3",
    examiner: "Ustadz Fahrurrazi, S.Pd & Tim Tahfidz",
    quota: 80,
    filled: 68
  },
  {
    id: "sch-003",
    title: "Seleksi Masuk & Wawancara Asrama SMPIT / SMAIT",
    unit: "SMP01",
    date: "2026-11-12",
    startTime: "08:00",
    endTime: "14:00",
    room: "Gedung Al-Khawarizmi Lt. 2",
    examiner: "Dr. Tgk. H. Munawwar, M.Ag & Mudir Asrama",
    quota: 60,
    filled: 45
  },
  {
    id: "sch-004",
    title: "Tes Bakat Skolastik & Tahfidz Mutqin SMAIT",
    unit: "SMA01",
    date: "2026-11-14",
    startTime: "08:30",
    endTime: "13:00",
    room: "Laboratorium Bahasa & Masjid Kampus",
    examiner: "Ust. Khairul Umam, Lc., M.H.",
    quota: 50,
    filled: 28
  }
];
var INITIAL_FORM_SCHEMAS = [
  {
    unitId: "TK01",
    sections: [
      {
        id: "sec-tk-1",
        title: "Data Pribadi Calon Siswa TK",
        description: "Informasi identitas dasar anak sesuai Akta Kelahiran",
        fields: [
          {
            id: "fullName",
            label: "Nama Lengkap Calon Siswa",
            type: "text",
            required: true,
            helpText: "Nama lengkap sesuai Akta Kelahiran / Kartu Keluarga",
            systemKey: "fullName",
            locked: true
          },
          { id: "f-1", label: "Nama Panggilan Anak", type: "text", required: true, helpText: "Nama panggilan yang akrab di rumah" },
          { id: "f-2", label: "Anak ke- (dari berapa bersaudara)", type: "number", required: true }
        ]
      },
      {
        id: "sec-1794113132432",
        title: "Data ayah",
        fields: [
          { id: "f-1794113134638", label: "Nama ayah", type: "text", required: true },
          { id: "f-1794113146343", label: "Pekerjaan ayah", type: "text", required: true }
        ]
      }
    ]
  },
  {
    unitId: "SD01",
    sections: [
      {
        id: "sec-sd-1",
        title: "Data Siswa & Kesiapan Masuk SD",
        description: "Pastikan data cocok dengan data Dapodik/TK asal",
        fields: [
          {
            id: "fullName",
            label: "Nama Lengkap Calon Siswa",
            type: "text",
            required: true,
            helpText: "Nama lengkap sesuai Akta Kelahiran / Kartu Keluarga",
            systemKey: "fullName",
            locked: true
          },
          { id: "f-sd-1", label: "Nama TK Asal / PAUD", type: "text", required: true },
          { id: "f-sd-2", label: "Kemampuan Membaca Huruf Hijaiyah / Latin", type: "dropdown", required: true, options: ["Lancar Hijaiyah & Latin", "Bisa Dasar Iqra 1-3", "Pengenalan Huruf"] },
          { id: "f-sd-3", label: "Jumlah Hafalan Surat Pendek (Juz 30)", type: "dropdown", required: true, options: ["Belum Hafal", "1 - 5 Surat", "An-Nas s.d Ad-Dhuha", "1 Juz Lengkap"] }
        ]
      }
    ]
  },
  {
    unitId: "SMP01",
    sections: [
      {
        id: "sec-smp-1",
        title: "Akademik & Pilihan Tinggal",
        fields: [
          {
            id: "fullName",
            label: "Nama Lengkap Calon Siswa",
            type: "text",
            required: true,
            helpText: "Nama lengkap sesuai Ijazah / Kartu Keluarga",
            systemKey: "fullName",
            locked: true
          },
          { id: "f-smp-1", label: "Pilihan Program", type: "dropdown", required: true, options: ["Boarding School (Asrama)", "Full Day School (Pulang-Pergi)"] },
          { id: "f-smp-2", label: "NPSN SD Asal", type: "text", required: true },
          { id: "f-smp-3", label: "Target Hafalan Al-Qur'an", type: "dropdown", required: true, options: ["Reguler 5 Juz", "Intensif Tahfidz 15 Juz", "Takhassus 30 Juz"] }
        ]
      }
    ]
  },
  {
    unitId: "SMA01",
    sections: [
      {
        id: "sec-sma-1",
        title: "Peminatan Jurusan & Minat Karir",
        fields: [
          {
            id: "fullName",
            label: "Nama Lengkap Calon Siswa",
            type: "text",
            required: true,
            helpText: "Nama lengkap sesuai Ijazah / Kartu Keluarga",
            systemKey: "fullName",
            locked: true
          },
          { id: "f-sma-1", label: "Pilihan Peminatan", type: "dropdown", required: true, options: ["MIPA (Sains & Kedokteran)", "IPS / Keagamaan & Humaniora"] },
          { id: "f-sma-2", label: "Rencana Kelanjutan Studi", type: "dropdown", required: true, options: ["PTN Favorit Indonesia (UI/ITB/UGM/USK)", "Universitas Timur Tengah (Al-Azhar/Madinah)", "Kampus Kedinasan / Militer", "Universitas Luar Negeri Lainnya"] }
        ]
      }
    ]
  }
];
var INITIAL_ROLES = [
  {
    id: "role-master",
    name: "Super Admin Yayasan",
    schoolId: "MASTER",
    permissions: ["Dashboard", "Pendaftar", "Verifikasi", "Jadwal", "Kelulusan", "Pembayaran", "Laporan", "Form Builder", "Manajemen Role", "Kelola Users", "Tahun Ajaran", "Kuota & Biaya", "Kelola Landing", "Status Sistem", "Audit Log"],
    description: "Akses penuh ke semua modul dan seluruh 4 unit sekolah Yayasan Ar-Risalah",
    userCount: 2
  },
  {
    id: "role-admin-yys",
    name: "Admin Yayasan (Monitoring)",
    schoolId: "MASTER",
    permissions: [
      "Dashboard",
      "Pendaftar:view",
      "Verifikasi:view",
      "Jadwal:view",
      "Kelulusan:view",
      "Pembayaran:view",
      "Laporan:view",
      "Form Builder:view"
    ],
    description: "Pengawasan/Monitoring tingkat yayasan (Lihat data, tanpa izin ubah/hapus/verifikasi)",
    userCount: 1
  },
  {
    id: "role-verifikator",
    name: "Staf Verifikator Berkas",
    schoolId: "MASTER",
    permissions: ["Dashboard", "Pendaftar", "Verifikasi"],
    description: "Memeriksa keabsahan dokumen berkas KK, Akta, Rapor dan Foto calon siswa",
    userCount: 4
  },
  {
    id: "role-bendahara",
    name: "Bendahara Keuangan",
    schoolId: "MASTER",
    permissions: ["Dashboard", "Pembayaran", "Laporan"],
    description: "Memvalidasi bukti transfer pendaftaran formulir dan biaya daftar ulang",
    userCount: 3
  },
  {
    id: "role-penguji",
    name: "Tim Penguji & Seleksi",
    schoolId: "MASTER",
    permissions: ["Dashboard", "Jadwal", "Kelulusan"],
    description: "Mengatur jadwal observasi, menginput nilai tes, dan menetapkan hasil kelulusan",
    userCount: 5
  },
  {
    id: "role-adm-tk",
    name: "Admin Unit TKIT",
    schoolId: "TK01",
    permissions: ["Dashboard", "Pendaftar", "Verifikasi", "Jadwal", "Kelulusan", "Form Builder"],
    description: "Pengelola operasional pendaftaran khusus unit TKIT Ar-Risalah",
    userCount: 2
  },
  {
    id: "role-wali",
    name: "Wali Siswa",
    schoolId: "MASTER",
    permissions: ["Portal Wali", "Anak Saya", "Pembayaran", "Profil"],
    description: "Portal mandiri orang tua/wali untuk pendaftaran multi-anak, linimasa, dan cetak kartu ujian",
    userCount: 1
  }
];
var INITIAL_USERS = [
  {
    id: "usr-master",
    name: "Super Admin Master Yayasan",
    email: "master@dev.com",
    phone: "081269000001",
    schoolId: "MASTER",
    role: "Super Admin Yayasan",
    permissions: ["Dashboard", "Pendaftar", "Verifikasi", "Jadwal", "Kelulusan", "Pembayaran", "Laporan", "Form Builder", "Manajemen Role", "Kelola Users", "Tahun Ajaran", "Kuota & Biaya", "Kelola Landing", "Status Sistem", "Audit Log"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-25 10:00"
  },
  {
    id: "usr-admin-yys",
    name: "Admin Yayasan Ar-Risalah",
    email: "adminyys@dev.com",
    phone: "081269000002",
    schoolId: "MASTER",
    role: "Admin Yayasan (Monitoring)",
    permissions: ["Dashboard", "Pendaftar:view", "Verifikasi:view", "Jadwal:view", "Kelulusan:view", "Pembayaran:view", "Laporan:view", "Form Builder:view"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-25 09:30"
  },
  {
    id: "usr-admin-tk",
    name: "Admin Unit TKIT",
    email: "admintk@dev.com",
    phone: "081269000003",
    schoolId: "TK01",
    role: "Admin Unit TKIT",
    permissions: ["Dashboard", "Pendaftar", "Verifikasi", "Jadwal", "Kelulusan", "Form Builder"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-25 09:00"
  },
  {
    id: "usr-admin-sd",
    name: "Admin Unit SDIT",
    email: "adminsd@dev.com",
    phone: "081269000004",
    schoolId: "SD01",
    role: "Admin Unit SDIT",
    permissions: ["Dashboard", "Pendaftar", "Verifikasi", "Jadwal", "Kelulusan", "Form Builder"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-25 08:45"
  },
  {
    id: "usr-admin-smp",
    name: "Admin Unit SMPIT",
    email: "adminsmp@dev.com",
    phone: "081269000005",
    schoolId: "SMP01",
    role: "Admin Unit SMPIT",
    permissions: ["Dashboard", "Pendaftar", "Verifikasi", "Jadwal", "Kelulusan", "Form Builder"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-25 08:30"
  },
  {
    id: "usr-admin-sma",
    name: "Admin Unit SMAIT",
    email: "adminsma@dev.com",
    phone: "081269000006",
    schoolId: "SMA01",
    role: "Admin Unit SMAIT",
    permissions: ["Dashboard", "Pendaftar", "Verifikasi", "Jadwal", "Kelulusan", "Form Builder"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-25 08:15"
  },
  {
    id: "usr-verifikator",
    name: "Staf Verifikator Berkas",
    email: "verifikator@dev.com",
    phone: "081269000007",
    schoolId: "MASTER",
    role: "Staf Verifikator Berkas",
    permissions: ["Dashboard", "Pendaftar", "Verifikasi"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-25 08:00"
  },
  {
    id: "usr-bendahara",
    name: "Bendahara Keuangan",
    email: "bendahara@dev.com",
    phone: "081269000008",
    schoolId: "MASTER",
    role: "Bendahara Keuangan",
    permissions: ["Dashboard", "Pembayaran", "Laporan"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-25 07:45"
  },
  {
    id: "usr-wali",
    name: "Rahmat Hidayat, S.T.",
    email: "dilfarisna@gmail.com",
    phone: "081269001234",
    schoolId: "TK01",
    role: "Wali Siswa",
    permissions: ["Portal Wali", "Anak Saya", "Pembayaran", "Profil"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-25 09:15",
    studentId: "reg-001",
    studentRegistrationNumber: "PPDB-2026-TK01-001"
  },
  {
    id: "usr-1",
    name: "Ustadz Faisal, S.Pd",
    email: "faisal.admin@arrisalahaceh.or.id",
    phone: "081269887766",
    schoolId: "MASTER",
    role: "Super Admin Yayasan",
    permissions: ["Dashboard", "Pendaftar", "Verifikasi", "Jadwal", "Kelulusan", "Pembayaran", "Laporan", "Form Builder", "Manajemen Role", "Kelola Users", "Tahun Ajaran", "Kuota & Biaya", "Kelola Landing", "Status Sistem", "Audit Log"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-24 20:45"
  },
  {
    id: "usr-2",
    name: "Cut Mutia, S.E. (Bendahara)",
    email: "keuangan@arrisalahaceh.or.id",
    phone: "081370221144",
    schoolId: "MASTER",
    role: "Bendahara Keuangan",
    permissions: ["Dashboard", "Pembayaran", "Laporan"],
    isActive: true,
    emailVerified: true,
    lastLogin: "2026-10-24 18:10"
  }
];
var INITIAL_ACADEMIC_YEARS = [
  {
    id: "ay-2026",
    year: "2026/2027",
    startDate: "2026-10-01",
    endDate: "2027-02-28",
    isActive: true
  },
  {
    id: "ay-2025",
    year: "2025/2026",
    startDate: "2025-10-01",
    endDate: "2026-02-28",
    isActive: false
  },
  {
    id: "ay-2024",
    year: "2024/2025",
    startDate: "2024-10-01",
    endDate: "2025-02-28",
    isActive: false
  }
];
var INITIAL_LANDING_CONFIG = [
  {
    appName: "PPDB Ar-Risalah Aceh",
    appTagline: "Yayasan Ar-Risalah Aceh",
    heroTitle: "Membentuk Generasi Qur'ani, Berkarakter, dan Berprestasi Global",
    heroSubtitle: "Selamat datang di Sistem Penerimaan Peserta Didik Baru (PPDB) Sekolah Islam Terpadu Yayasan Ar-Risalah Aceh. Pendaftaran Online Resmi untuk jenjang TKIT, SDIT, SMPIT, dan SMAIT Tahun Ajaran 2026/2027.",
    statsTotal: 826,
    heroSlides: [
      {
        id: "slide-1",
        imageUrl: "/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg",
        upperPoints: ["Terakreditasi A & Berizin Resmi", "Total 826+ Calon Siswa Mendaftar"],
        title: "Pendidikan Holistik Islami",
        subtitle: "Tahfidz 30 Juz & Kurikulum Internasional",
        icon: "Award"
      },
      {
        id: "slide-2",
        imageUrl: "/src/assets/images/students_learning_aceh_1792900905933.jpg",
        upperPoints: ["Fasilitas Asrama Ber-AC & Sanitasi Bersih", "Persiapan Lulusan PTN & Luar Negeri"],
        title: "Lingkungan Belajar Asri & Nyaman",
        subtitle: "Kombinasi Ilmu Agama dan Sains Modern",
        icon: "ShieldCheck"
      },
      {
        id: "slide-3",
        imageUrl: "/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg",
        upperPoints: ["Beasiswa Siswa Berprestasi & Yatim", "Ekstrakurikuler Panahan, Robotik & Bahasa"],
        title: "Bimbingan Karakter & Leadership",
        subtitle: "Mencetak Pemimpin Masa Depan Berakhlak Mulia",
        icon: "Sparkles"
      }
    ],
    flowSteps: [
      { step: 1, title: "Pemilihan Unit & Akun", description: "Tentukan jenjang pendidikan yang sesuai (TKIT, SDIT, SMPIT, atau SMAIT) dan buat akun orang tua/wali siswa." },
      { step: 2, title: "Pengisian Formulir", description: "Isi biodata calon siswa, data orang tua/wali, serta riwayat kesehatan secara teliti." },
      { step: 3, title: "Unggah Berkas Persyaratan", description: "Upload scan atau foto resmi Kartu Keluarga, Akta Kelahiran, dan Pas Foto terbaru anak." },
      { step: 4, title: "Pembayaran Formulir", description: "Lakukan transfer biaya registrasi ke rekening BSI Yayasan Ar-Risalah dan unggah buktinya." },
      { step: 5, title: "Observasi / Tes & Pengumuman", description: "Ikuti jadwal tes/observasi kesiapan, dan pantau pengumuman kelulusan resmi di aplikasi." }
    ],
    requirements: [
      "Foto / Scan Kartu Keluarga (KK) yang masih berlaku",
      "Foto / Scan Akta Kelahiran calon siswa",
      "Pas Foto Berwarna terbaru (background merah/biru)",
      "NISN 10 digit (khusus pendaftar SD, SMP, SMA)",
      "Surat Keterangan Sehat dari Fasilitas Kesehatan / Puskesmas",
      "Scan Ijazah / Rapor 2 semester terakhir (untuk jenjang SMP & SMA)"
    ],
    contact: {
      email: "info@arrisalahaceh.or.id",
      phone: "0812-6900-1234",
      whatsapp: "0812-6900-1234",
      address: "Jl. BTN Kupula Indah, Geulanggang Gampong (Geulanggang Baro), Kec. Kota Juang, Kab. Bireuen, Aceh",
      instagram: "@arrisalahaceh"
    },
    helpTitle: "Perlu Bantuan / Kendala Pendaftaran?",
    helpSubtitle: "Tim panitia PPDB Yayasan Ar-Risalah Aceh siap membantu Anda setiap Senin - Sabtu pukul 08:00 - 16:00 WIB.",
    logoUrl: "/uploads/logo.png",
    faviconUrl: "/uploads/favicon.ico",
    metaTitle: "PPDB Ar-Risalah Aceh | Penerimaan Peserta Didik Baru 2026/2027",
    metaDescription: "Sistem Penerimaan Peserta Didik Baru (PPDB) Yayasan Ar-Risalah Aceh untuk jenjang TKIT, SDIT, SMPIT, dan SMAIT Tahun Ajaran 2026/2027. Pendaftaran Online Resmi.",
    metaKeywords: "PPDB, Ar-Risalah, Aceh, Bireuen, Sekolah Islam Terpadu, TKIT, SDIT, SMPIT, SMAIT, Tahfidz Al-Quran, Boarding School",
    author: "Yayasan Ar-Risalah Aceh",
    ogTitle: "PPDB Ar-Risalah Aceh | Penerimaan Peserta Didik Baru",
    ogDescription: "Sistem Pendaftaran Online Resmi Sekolah Islam Terpadu Yayasan Ar-Risalah Aceh jenjang TK, SD, SMP, & SMA T.A 2026/2027.",
    ogImage: "/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg",
    canonicalUrl: "https://arrisalahaceh.or.id/ppdb",
    jsonLdType: "EducationalOrganization",
    structuredDataJson: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        name: "Yayasan Ar-Risalah Aceh",
        url: "https://arrisalahaceh.or.id",
        logo: "https://arrisalahaceh.or.id/logo.png",
        description: "Sistem Penerimaan Peserta Didik Baru (PPDB) Yayasan Ar-Risalah Aceh untuk jenjang TKIT, SDIT, SMPIT, dan SMAIT.",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Jl. BTN Kupula Indah, Geulanggang Gampong",
          addressLocality: "Bireuen",
          addressRegion: "Aceh",
          postalCode: "24251",
          addressCountry: "ID"
        },
        telephone: "+6281269001234",
        sameAs: ["https://instagram.com/arrisalahaceh"]
      },
      null,
      2
    )
  }
][0];
var INITIAL_AUDIT_LOGS = [
  {
    id: "log-01",
    timestamp: "2026-10-24 20:45:12",
    userEmail: "faisal.admin@arrisalahaceh.or.id",
    action: "login",
    schoolId: "MASTER",
    details: "Login berhasil via SSO Pengurus Yayasan dengan 2FA aktif",
    ipAddress: "180.252.164.12"
  },
  {
    id: "log-02",
    timestamp: "2026-10-24 19:30:05",
    userEmail: "keuangan@arrisalahaceh.or.id",
    action: "verifikasi",
    schoolId: "MASTER",
    details: "Verifikasi bukti transfer formulir pendaftar PPDB-2026-SD01-042 status LUNAS",
    ipAddress: "114.125.77.89"
  },
  {
    id: "log-03",
    timestamp: "2026-10-24 17:15:40",
    userEmail: "verifikator.sd@arrisalahaceh.or.id",
    action: "verifikasi",
    schoolId: "SD01",
    details: "Verifikasi berkas persyaratan PPDB-2026-SD01-089 disetujui (KK & Akta valid)",
    ipAddress: "182.1.200.45"
  },
  {
    id: "log-04",
    timestamp: "2026-10-24 15:20:18",
    userEmail: "faisal.admin@arrisalahaceh.or.id",
    action: "update_kuota",
    schoolId: "MASTER",
    details: "Sinkronisasi update kuota daya tampung jenjang SDIT dari 550 menjadi 600 siswa",
    ipAddress: "180.252.164.12"
  },
  {
    id: "log-05",
    timestamp: "2026-10-24 14:02:11",
    userEmail: "sistem.ppdb@arrisalahaceh.or.id",
    action: "create_pendaftar",
    schoolId: "SMP01",
    details: "Pendaftaran online mandiri wali siswa: PPDB-2026-SMP01-018 an. Sulthan Thariq",
    ipAddress: "36.85.90.104"
  }
];
var INITIAL_SYSTEM_STATUS = {
  databaseConnected: true,
  csrfActive: true,
  sessionDuration: "2 Jam (Rotasi Token)",
  rateLimit: "5 request / 5 menit (Strict)",
  auditLogActive: true,
  securityHeadersActive: true,
  lastBackup: "2026-10-24 04:00 WIB (Automated Cloud Snapshot)"
};
var INITIAL_EXPORT_CONFIGS = [
  {
    id: "Pendaftar_ALL",
    moduleName: "Pendaftar",
    roleId: "ALL",
    allowedHeaders: [
      "No",
      "No. Registrasi",
      "Nama Lengkap",
      "Unit",
      "Data Formulir (Ringkasan Form Builder)",
      "Status Pendaftaran",
      "Tanggal Daftar",
      "Nilai Tes"
    ],
    updatedAt: "2026-10-25 08:00",
    updatedBy: "Super Admin Master"
  },
  {
    id: "Verifikasi_ALL",
    moduleName: "Verifikasi",
    roleId: "ALL",
    allowedHeaders: [
      "No",
      "No. Registrasi",
      "Nama Lengkap",
      "Unit",
      "Data Isian & Berkas Form Builder",
      "Status Verifikasi",
      "Catatan Verifikator"
    ],
    updatedAt: "2026-10-25 08:00",
    updatedBy: "Super Admin Master"
  },
  {
    id: "Jadwal_ALL",
    moduleName: "Jadwal",
    roleId: "ALL",
    allowedHeaders: [
      "No",
      "Judul Seleksi",
      "Unit",
      "Tanggal",
      "Waktu Mulai",
      "Waktu Selesai",
      "Ruangan",
      "Penguji",
      "Kuota",
      "Terisi"
    ],
    updatedAt: "2026-10-25 08:00",
    updatedBy: "Super Admin Master"
  },
  {
    id: "Kelulusan_ALL",
    moduleName: "Kelulusan",
    roleId: "ALL",
    allowedHeaders: [
      "No",
      "No. Registrasi",
      "Nama Lengkap",
      "Unit",
      "Nilai Tes",
      "Status Kelulusan",
      "Status Publikasi"
    ],
    updatedAt: "2026-10-25 08:00",
    updatedBy: "Super Admin Master"
  },
  {
    id: "Pembayaran_ALL",
    moduleName: "Pembayaran",
    roleId: "ALL",
    allowedHeaders: [
      "No",
      "No. Registrasi",
      "Nama Lengkap",
      "Unit",
      "Jenis Biaya",
      "Nominal (Rp)",
      "Bank",
      "Status Pembayaran",
      "Tanggal"
    ],
    updatedAt: "2026-10-25 08:00",
    updatedBy: "Super Admin Master"
  },
  {
    id: "Laporan_ALL",
    moduleName: "Laporan",
    roleId: "ALL",
    allowedHeaders: [
      "No",
      "Unit Sekolah",
      "Nama Siswa",
      "Jenis Transaksi",
      "Kategori Pembayaran",
      "Nominal (Rp)",
      "Waktu Transaksi",
      "Status"
    ],
    updatedAt: "2026-10-25 08:00",
    updatedBy: "Super Admin Master"
  },
  {
    id: "Users_ALL",
    moduleName: "Users",
    roleId: "ALL",
    allowedHeaders: [
      "No",
      "Nama Lengkap",
      "Email",
      "No. Telepon",
      "Unit Tugas",
      "Role / Jabatan",
      "Status Akun",
      "Terakhir Masuk"
    ],
    updatedAt: "2026-10-25 08:00",
    updatedBy: "Super Admin Master"
  },
  {
    id: "Audit Log_ALL",
    moduleName: "Audit Log",
    roleId: "ALL",
    allowedHeaders: [
      "No",
      "Waktu (WIB)",
      "Pengguna / Email",
      "Unit Sekolah",
      "Kategori Tindakan",
      "Rincian Aktivitas",
      "Alamat IP"
    ],
    updatedAt: "2026-10-25 08:00",
    updatedBy: "Super Admin Master"
  }
];
var INITIAL_SMTP_CONFIG = {
  enabled: true,
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  senderEmail: "ppdb.arrisalah.aceh@gmail.com",
  senderName: "Panitia PPDB Yayasan Ar-Risalah Aceh",
  authPassword: "",
  isVerified: false,
  lastTested: "Belum diuji"
};
var INITIAL_GROUP_LINKS = [
  {
    unitId: "ALL",
    groupUrl: "https://chat.whatsapp.com/ArRisalahPPDB2026Umum",
    groupName: "Komunitas WhatsApp PPDB Ar-Risalah 2026/2027",
    visibilityRule: "always"
  },
  {
    unitId: "TK01",
    groupUrl: "https://chat.whatsapp.com/TKITArRisalah2026",
    groupName: "Grup Calon Siswa & Wali TKIT Ar-Risalah",
    visibilityRule: "after_payment"
  },
  {
    unitId: "SD01",
    groupUrl: "https://chat.whatsapp.com/SDITArRisalah2026",
    groupName: "Grup Calon Siswa & Wali SDIT Ar-Risalah",
    visibilityRule: "after_payment"
  },
  {
    unitId: "SMP01",
    groupUrl: "https://chat.whatsapp.com/SMPITArRisalah2026",
    groupName: "Grup Calon Santri & Wali SMPIT Ar-Risalah",
    visibilityRule: "after_payment"
  },
  {
    unitId: "SMA01",
    groupUrl: "https://chat.whatsapp.com/SMAITArRisalah2026",
    groupName: "Grup Calon Santri & Wali SMAIT Ar-Risalah",
    visibilityRule: "after_payment"
  }
];
var INITIAL_CLOUDFLARE_CONFIG = {
  enabled: false,
  siteKey: "",
  secretKey: "",
  mode: "managed",
  appearance: "always",
  updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
  updatedBy: "Master Admin"
};
var INITIAL_UNIT_CONTACTS = [
  {
    unitId: "MASTER",
    unitName: "Yayasan Ar-Risalah Aceh (Pusat)",
    contactPerson: "Ustadz H. Zulfikar, S.Pd.I (Sekretariat PPDB Pusat)",
    phone: "081269001234",
    whatsapp: "6281269001234",
    email: "ppdb@arrisalahaceh.sch.id",
    officeHours: "Senin - Sabtu (08:00 - 16:00 WIB)",
    address: "Jl. BTN Kupula Indah, Geulanggang Gampong, Kec. Kota Juang, Kab. Bireuen, Aceh",
    notes: "Layanan informasi umum yayasan, kebijakan pendaftaran, dan mutasi antarsekolah.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: "Master Admin"
  },
  {
    unitId: "TK01",
    unitName: "TKIT Ar-Risalah Aceh",
    contactPerson: "Ustadzah Rahmawati, S.Pd (Panitia PPDB TKIT)",
    phone: "085277112233",
    whatsapp: "6285277112233",
    email: "tkit@arrisalahaceh.sch.id",
    officeHours: "Senin - Jumat (08:00 - 14:00 WIB)",
    address: "Gedung TKIT Ar-Risalah, Komplek Pendidikan Ar-Risalah Bireuen",
    notes: "Layanan informasi konsultasi tumbuh kembang balita & seleksi masuk TKIT.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: "Admin Unit TKIT"
  },
  {
    unitId: "SD01",
    unitName: "SDIT Ar-Risalah Aceh",
    contactPerson: "Ustadz M. Husaini, M.Pd (Panitia PPDB SDIT)",
    phone: "081360998877",
    whatsapp: "6281360998877",
    email: "sdit@arrisalahaceh.sch.id",
    officeHours: "Senin - Sabtu (08:00 - 15:00 WIB)",
    address: "Gedung SDIT Ar-Risalah, Jl. BTN Kupula Indah Bireuen",
    notes: "Konsultasi berkas pendaftaran, tes kesiapan membaca Al-Qur'an, & observasi siswa.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: "Admin Unit SDIT"
  },
  {
    unitId: "SMP01",
    unitName: "SMPIT Ar-Risalah Aceh (Boarding/Full Day)",
    contactPerson: "Ustadz Ahmad Farhan, S.Ag (Panitia PPDB SMPIT)",
    phone: "082165443322",
    whatsapp: "6282165443322",
    email: "smpit@arrisalahaceh.sch.id",
    officeHours: "Senin - Sabtu (08:00 - 16:00 WIB)",
    address: "Kampus SMPIT Ar-Risalah, Kompleks Asrama Santri Bireuen",
    notes: "Informasi tes akademis, wawancara santri & wali, serta penempatan asrama.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: "Admin Unit SMPIT"
  },
  {
    unitId: "SMA01",
    unitName: "SMAIT Ar-Risalah Aceh (Boarding School)",
    contactPerson: "Ustadz Dr. Rahmat Hidayat, M.A (Panitia PPDB SMAIT)",
    phone: "085399887766",
    whatsapp: "6285399887766",
    email: "smait@arrisalahaceh.sch.id",
    officeHours: "Senin - Sabtu (08:00 - 16:30 WIB)",
    address: "Kampus Utama SMAIT Ar-Risalah Boarding School, Bireuen",
    notes: "Informasi program peminatan PTN/Timur Tengah, beasiswa tahfidz, & wawancara.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: "Admin Unit SMAIT"
  }
];
var INITIAL_LETTER_CONFIGS = [
  {
    unitId: "MASTER",
    unitName: "Default Semua Unit (Yayasan Master)",
    committeeChairName: "Ustadz Dr. Rahmat Hidayat, M.A",
    committeeChairNip: "NIPY. 19850412 201001 1 002",
    committeeRoleTitle: "Ketua Panitia PPDB Yayasan",
    letterHeaderTitle: "PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)",
    cardTitle: "KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB",
    issueLocation: "Bireuen",
    issueDate: "",
    examInstructions: [
      "1. Peserta wajib hadir 15 menit sebelum pelaksanaan ujian seleksi dimulai.",
      "2. Membawa Kartu Tanda Peserta ini (cetak fisik) dan alat tulis secukupnya.",
      "3. Berpakaian sopan, rapi, dan menutup aurat (busana muslim/muslimah).",
      "4. Orang tua/wali santri wajib mendampingi ananda saat sesi wawancara orang tua."
    ],
    stampNote: "Dokumen ini diterbitkan sah secara elektronik oleh Panitia PPDB Ar-Risalah Aceh.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: "System Master"
  },
  {
    unitId: "TK01",
    unitName: "TKIT Ar-Risalah Aceh",
    committeeChairName: "Ustadzah Nurul Hidayati, S.Pd",
    committeeChairNip: "NIPY. 19900815 201402 2 005",
    committeeRoleTitle: "Ketua Panitia PPDB TKIT",
    letterHeaderTitle: "PANITIA PPDB TKIT AR-RISALAH ACEH",
    cardTitle: "KARTU TANDA PESERTA OBSERVASI & PEMETAAN TKIT",
    issueLocation: "Bireuen",
    issueDate: "",
    examInstructions: [
      "1. Ananda didampingi oleh 1 orang tua/wali saat pelaksanaan pemetaan kesiapan TKIT.",
      "2. Membawa Kartu Peserta ini dan perlengkapan mewarnai sederhana.",
      "3. Peserta datang 15 menit sebelum jam sesi observasi.",
      "4. Mengenakan pakaian bebas rapi dan sopan."
    ],
    stampNote: "Dokumen sah Panitia PPDB TKIT Ar-Risalah.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: "Admin Unit TKIT"
  },
  {
    unitId: "SD01",
    unitName: "SDIT Ar-Risalah Aceh",
    committeeChairName: "Ustadz Muhammad Rizky, S.Pd.I",
    committeeChairNip: "NIPY. 19880210 201201 1 003",
    committeeRoleTitle: "Ketua Panitia PPDB SDIT",
    letterHeaderTitle: "PANITIA PPDB SDIT AR-RISALAH ACEH",
    cardTitle: "KARTU TANDA PESERTA SELEKSI & PEMETAAN SDIT",
    issueLocation: "Bireuen",
    issueDate: "",
    examInstructions: [
      "1. Wajib membawa kartu fisik ini saat memasuki ruang seleksi pemetaan SDIT.",
      "2. Membawa pensil 2B dan penghapus.",
      "3. Hadir 15 menit sebelum tes baca Al-Qur'an/Iqro dimulai.",
      "4. Orang tua mengikuti sesi wawancara di ruangan terpisah yang telah ditentukan."
    ],
    stampNote: "Dokumen sah Panitia PPDB SDIT Ar-Risalah.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: "Admin Unit SDIT"
  },
  {
    unitId: "SMP01",
    unitName: "SMPIT Ar-Risalah Aceh",
    committeeChairName: "Ustadz Ahmad Farhan, S.Ag",
    committeeChairNip: "NIPY. 19820518 200801 1 001",
    committeeRoleTitle: "Ketua Panitia PPDB SMPIT",
    letterHeaderTitle: "PANITIA PPDB SMPIT AR-RISALAH ACEH",
    cardTitle: "KARTU TANDA PESERTA SELEKSI UJIAN AKADEMIS & TAHFIDZ SMPIT",
    issueLocation: "Bireuen",
    issueDate: "",
    examInstructions: [
      "1. Wajib membawa kartu seleksi resmi fisik dan kartu identitas pendukung.",
      "2. Tes meliputi Ujian Akademis (MTK, IPA, Bhs Indonesia) & Tes Tahfidz Al-Qur'an.",
      "3. Berbusana muslim/muslimah rapi berpeci/berjilbab.",
      "4. Wawancara santri & wali santri dilaksanakan di hari yang sama."
    ],
    stampNote: "Dokumen sah Panitia PPDB SMPIT Ar-Risalah.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: "Admin Unit SMPIT"
  },
  {
    unitId: "SMA01",
    unitName: "SMAIT Ar-Risalah Boarding School",
    committeeChairName: "Ustadz Dr. H. Rahmat Hidayat, M.A",
    committeeChairNip: "NIPY. 19791104 200501 1 001",
    committeeRoleTitle: "Ketua Panitia PPDB SMAIT",
    letterHeaderTitle: "PANITIA PPDB SMAIT AR-RISALAH BOARDING SCHOOL",
    cardTitle: "KARTU TANDA PESERTA SELEKSI MASUK SMAIT BOARDING SCHOOL",
    issueLocation: "Bireuen",
    issueDate: "",
    examInstructions: [
      "1. Hadir 20 menit sebelum tes dimulai di Kampus Utama SMAIT Boarding School.",
      "2. Membawa kartu peserta seleksi dan papan dada alas tulis.",
      "3. Mengikuti tes akademik, tes minat-bakat, wawancara Bahasa Arab/Inggris, & tahfidz.",
      "4. Wali santri wajib menghadiri penjelasan program boarding school & wawancara komitmen."
    ],
    stampNote: "Dokumen sah Panitia PPDB SMAIT Ar-Risalah Boarding School.",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: "Admin Unit SMAIT"
  }
];

// src/utils/studentFieldResolver.ts
var CORE_NAME_FIELD_ID = "fullName";
function isLockedNameField(field) {
  if (!field) return false;
  return field.systemKey === "fullName" || String(field.id || "").toLowerCase() === "fullname" || field.locked === true;
}
function createDefaultCoreNameField(existing) {
  const existingLabel = typeof existing?.label === "string" && existing.label.trim() ? existing.label.trim() : "Nama Lengkap Calon Siswa";
  return {
    id: CORE_NAME_FIELD_ID,
    label: existingLabel,
    type: "text",
    required: true,
    helpText: typeof existing?.helpText === "string" && existing.helpText.trim() ? existing.helpText : "Nama lengkap calon siswa (wajib & tampil di daftar pendaftar)",
    systemKey: "fullName",
    locked: true
  };
}
function ensureCoreNameFieldInSections(sections, unitId = "UNIT") {
  const safeSections = Array.isArray(sections) ? sections.map((sec) => ({
    ...sec,
    fields: Array.isArray(sec.fields) ? sec.fields.map((f) => ({ ...f })) : []
  })) : [];
  if (safeSections.length === 0) {
    return [
      {
        id: `sec-${unitId.toLowerCase()}-1`,
        title: "Data Calon Siswa",
        description: "Identitas utama calon peserta didik",
        fields: [createDefaultCoreNameField()]
      }
    ];
  }
  let foundCoreField = null;
  for (let sIdx = 0; sIdx < safeSections.length; sIdx++) {
    const idx = safeSections[sIdx].fields.findIndex((f) => isLockedNameField(f));
    if (idx !== -1) {
      const target = safeSections[sIdx].fields[idx];
      foundCoreField = {
        ...target,
        id: target.id || CORE_NAME_FIELD_ID,
        type: "text",
        required: true,
        systemKey: "fullName",
        locked: true
      };
      safeSections[sIdx].fields.splice(idx, 1);
      break;
    }
  }
  const coreField = foundCoreField || createDefaultCoreNameField();
  safeSections[0].fields.unshift(coreField);
  return safeSections;
}
function getLockedNameFieldFromSchema(schema) {
  if (!schema || !Array.isArray(schema.sections)) return void 0;
  for (const sec of schema.sections) {
    const match = (sec.fields || []).find((f) => isLockedNameField(f));
    if (match) return match;
  }
  return void 0;
}
function resolveStudentNameFromSchema(student, schema) {
  const nameField = getLockedNameFieldFromSchema(schema);
  if (nameField) {
    const resolved = resolveFormFieldValue(student, nameField);
    if (resolved !== void 0 && resolved !== null && String(resolved).trim() !== "") {
      return String(resolved).trim();
    }
  }
  return student.fullName && String(student.fullName).trim() || "-";
}
function resolveFormFieldValue(student, f) {
  const dyn = student.dynamicAnswers || {};
  const direct = dyn[f.id];
  if (direct !== void 0 && direct !== null && String(direct).trim() !== "") {
    return f.type === "date" && typeof direct === "string" ? direct.slice(0, 10) : direct;
  }
  if (f.label && dyn[f.label] !== void 0 && dyn[f.label] !== null && String(dyn[f.label]).trim() !== "") {
    const byLabel = dyn[f.label];
    return f.type === "date" && typeof byLabel === "string" ? byLabel.slice(0, 10) : byLabel;
  }
  const l = (f.label || "").toLowerCase();
  const id = (f.id || "").toLowerCase();
  if (f.type === "file") {
    if (student.documents?.[f.id]) return student.documents[f.id];
    if (/kk|kartu.?keluarga/.test(l) || /kk/.test(id)) return student.documents?.kk || "";
    if (/akta|kelahiran/.test(l) || /akta/.test(id)) return student.documents?.akta || "";
    if (/foto|photo/.test(l) || /photo/.test(id)) return student.documents?.photo || "";
    if (/rapor/.test(l) || /rapor/.test(id)) return student.documents?.rapor || "";
    if (/ijazah|skl/.test(l) || /ijazah/.test(id)) return student.documents?.ijazah || "";
    return "";
  }
  const dynEntries = Object.entries(dyn).filter(
    ([, v]) => v !== void 0 && v !== null && String(v).trim() !== "" && !String(v).startsWith("data:")
  );
  const findLegacyDyn = (keyRegex) => {
    const hit = dynEntries.find(([k]) => keyRegex.test(k.toLowerCase()));
    return hit ? String(hit[1]) : void 0;
  };
  let matchedDyn;
  if (/panggilan|nickname/.test(l) || /nickname|panggilan/.test(id)) {
    matchedDyn = findLegacyDyn(/nickname|panggilan/) || findLegacyDyn(/fullname|nama_?lengkap/);
  } else if (/nama.?lengkap|nama.?santri|nama.?calon|nama.?peserta/.test(l) || id === "fullname") {
    matchedDyn = findLegacyDyn(/fullname|nama.?lengkap/);
  } else if (/nisn/.test(l) || /nisn/.test(id)) {
    matchedDyn = findLegacyDyn(/nisn/);
  } else if (/\bnis\b/.test(l) || /\bnis\b/.test(id)) {
    matchedDyn = findLegacyDyn(/\bnis\b|nisn/);
  } else if (/jenis.?kelamin/.test(l) || /gender/.test(id)) {
    matchedDyn = findLegacyDyn(/gender|kelamin/);
  } else if (/tempat.?lahir/.test(l) || /birthplace/.test(id)) {
    matchedDyn = findLegacyDyn(/birthplace|tempat/);
  } else if (/tanggal.?lahir/.test(l) || /birthdate/.test(id)) {
    matchedDyn = findLegacyDyn(/birthdate|tanggal/);
  } else if (/alamat/.test(l) || /address/.test(id)) {
    matchedDyn = findLegacyDyn(/address|alamat/);
  } else if (/tk.?asal|paud|sekolah.?asal|asal.?sekolah|nama.?sekolah/.test(l) || /schoolorigin|tkorigin/.test(id)) {
    matchedDyn = findLegacyDyn(/tkorigin|schoolorigin|sekolah|tk_?asal/);
  } else if (/npsn/.test(l) || /npsn/.test(id)) {
    matchedDyn = findLegacyDyn(/npsn/);
  } else if (/membaca|hijaiyah|latin|iqra/.test(l) || /reading/.test(id)) {
    matchedDyn = findLegacyDyn(/reading|membaca|baca/);
  } else if (/hafalan|surat|tahfidz|juz|quran|qur'an/.test(l) || /tahfidz|hafalan|quran/.test(id)) {
    matchedDyn = findLegacyDyn(/tahfidz|hafalan|quran/);
  } else if (/pilihan.?program/.test(l) || /program/.test(id)) {
    matchedDyn = findLegacyDyn(/program/);
  } else if (/peminatan|jurusan/.test(l) || /peminatan|jurusan/.test(id)) {
    matchedDyn = findLegacyDyn(/peminatan|jurusan/);
  } else if (/kelanjutan.?studi|rencana/.test(l) || /studi/.test(id)) {
    matchedDyn = findLegacyDyn(/studi|rencana/);
  } else if (/nama.?ayah|ayah/.test(l) && /nama/.test(l)) {
    matchedDyn = findLegacyDyn(/parentname|ayah|father/);
  } else if (/nama.?ibu|ibu/.test(l) && /nama/.test(l)) {
    matchedDyn = findLegacyDyn(/ibu|mother/);
  } else if (/nama.?orang.?tua|nama.?wali/.test(l) || /parentname/.test(id)) {
    matchedDyn = findLegacyDyn(/parentname|wali|ayah/);
  } else if (/pekerjaan/.test(l) || /parentjob/.test(id)) {
    matchedDyn = findLegacyDyn(/parentjob|pekerjaan|job/);
  } else if (/penghasilan/.test(l) || /parentincome/.test(id)) {
    matchedDyn = findLegacyDyn(/parentincome|penghasilan|income/);
  } else if (/whatsapp|nomor.?hp|no\.?\s*hp|telepon/.test(l) || /parentphone|phone/.test(id)) {
    matchedDyn = findLegacyDyn(/parentphone|phone|whatsapp|hp|telepon/);
  }
  if (matchedDyn !== void 0) {
    if (f.type === "dropdown" && Array.isArray(f.options)) {
      const exactOpt = f.options.find((opt) => opt.trim().toLowerCase() === matchedDyn.trim().toLowerCase());
      if (exactOpt) return exactOpt;
    }
    return f.type === "date" ? matchedDyn.slice(0, 10) : matchedDyn;
  }
  if (f.type === "dropdown" && Array.isArray(f.options) && f.options.length > 0) {
    for (const [, val] of dynEntries) {
      const sVal = String(val).trim().toLowerCase();
      const optMatch = f.options.find((opt) => opt.trim().toLowerCase() === sVal);
      if (optMatch) return optMatch;
    }
  }
  let colVal = "";
  if (isLockedNameField(f) || id === "fullname" || /^\s*nama\s*$/i.test(l) || /nama.?lengkap|nama.?santri|nama.?calon|nama.?peserta|nama.?anak|nama.?panggilan/.test(l) && !/ayah|ibu|wali|orang.?tua/.test(l)) {
    colVal = student.fullName || "";
  } else if (id === "nisn" || /nisn/.test(l)) {
    colVal = student.nisn || "";
  } else if (id === "gender" || /jenis.?kelamin/.test(l)) {
    colVal = student.gender || "";
  } else if (id === "birthplace" || /tempat.?lahir/.test(l)) {
    colVal = student.birthPlace || "";
  } else if (id === "birthdate" || /tanggal.?lahir/.test(l)) {
    colVal = student.birthDate ? String(student.birthDate).slice(0, 10) : "";
  } else if (id === "address" || /alamat/.test(l)) {
    colVal = student.address || "";
  } else if (id === "schoolorigin" || /sekolah.?asal|asal.?sekolah|nama.?tk|paud|nama.?sekolah/.test(l)) {
    colVal = student.schoolOrigin || "";
  } else if (id === "parentname" || /nama.?orang.?tua|nama.?wali|nama.?ayah/.test(l)) {
    colVal = student.parentName || "";
  } else if (id === "parentphone" || /whatsapp|nomor.?hp|no\.?\s*hp|telepon/.test(l)) {
    colVal = student.parentPhone || "";
  } else if (id === "parentjob" || /pekerjaan/.test(l)) {
    colVal = student.parentJob || "";
  } else if (id === "parentincome" || /penghasilan/.test(l)) {
    colVal = student.parentIncome || "";
  }
  if (colVal && f.type === "dropdown" && Array.isArray(f.options)) {
    const optMatch = f.options.find((opt) => opt.trim().toLowerCase() === colVal.trim().toLowerCase());
    return optMatch || "";
  }
  return colVal;
}
function formatCardFieldDisplayValue(rawValue, field) {
  if (rawValue === void 0 || rawValue === null) return "-";
  if (Array.isArray(rawValue)) {
    const joined = rawValue.map((v) => String(v || "").trim()).filter(Boolean).join(", ");
    return joined || "-";
  }
  const str = String(rawValue).trim();
  if (!str) return "-";
  if (field?.type === "file" || str.startsWith("data:")) {
    return "Berkas Terlampir";
  }
  return str;
}
function getDefaultCardFieldsFromSchema(unitFormSchema) {
  if (!unitFormSchema || !Array.isArray(unitFormSchema.sections)) return [];
  const fields = [];
  for (const sec of unitFormSchema.sections) {
    if (!Array.isArray(sec.fields)) continue;
    for (const f of sec.fields) {
      if (f.type === "file") continue;
      fields.push({
        fieldId: f.id,
        label: f.label,
        sectionTitle: sec.title
      });
    }
  }
  return fields;
}
function getCardBiodataRows(student, letterConfigs, unitFormSchema) {
  const allSchemaFields = [];
  const fieldById = /* @__PURE__ */ new Map();
  const fieldByLabelLower = /* @__PURE__ */ new Map();
  if (unitFormSchema && Array.isArray(unitFormSchema.sections)) {
    for (const sec of unitFormSchema.sections) {
      if (!Array.isArray(sec.fields)) continue;
      for (const f of sec.fields) {
        allSchemaFields.push(f);
        fieldById.set(f.id, f);
        if (f.label) {
          fieldByLabelLower.set(f.label.trim().toLowerCase(), f);
        }
      }
    }
  }
  let unitConfig;
  let masterConfig;
  if (Array.isArray(letterConfigs)) {
    unitConfig = letterConfigs.find((l) => l.unitId === student.unit);
    masterConfig = letterConfigs.find((l) => l.unitId === "MASTER");
  } else if (letterConfigs && typeof letterConfigs === "object") {
    if (!letterConfigs.unitId || letterConfigs.unitId === student.unit) {
      unitConfig = letterConfigs;
    } else if (letterConfigs.unitId === "MASTER") {
      masterConfig = letterConfigs;
    }
  }
  let chosenFields;
  if (unitConfig && Array.isArray(unitConfig.cardFields)) {
    chosenFields = unitConfig.cardFields;
  } else if (masterConfig && Array.isArray(masterConfig.cardFields) && masterConfig.cardFields.length > 0) {
    const matchingUnitFields = masterConfig.cardFields.filter(
      (cf) => fieldById.has(cf.fieldId) || fieldByLabelLower.has((cf.label || "").trim().toLowerCase())
    );
    if (matchingUnitFields.length > 0) {
      chosenFields = matchingUnitFields;
    }
  }
  if (chosenFields === void 0) {
    const schemaFields = getDefaultCardFieldsFromSchema(unitFormSchema);
    if (schemaFields.length > 0) {
      chosenFields = schemaFields;
    }
  }
  if (chosenFields !== void 0) {
    return chosenFields.map((cf) => {
      const schemaField = fieldById.get(cf.fieldId) || fieldByLabelLower.get((cf.label || "").trim().toLowerCase());
      const syntheticField = {
        id: schemaField?.id || cf.fieldId,
        label: schemaField?.label || cf.label,
        type: schemaField?.type || "text",
        options: schemaField?.options
      };
      const rawVal = resolveFormFieldValue(student, syntheticField);
      const formatted = formatCardFieldDisplayValue(rawVal, schemaField || syntheticField);
      return [cf.label, `: ${formatted}`];
    });
  }
  return [
    ["Nama Lengkap Calon Siswa", `: ${student.fullName || "-"}`],
    ["Unit Sekolah Pilihan", `: ${student.unit || "-"}`]
  ];
}
function getSchemaNonFileFields(unitFormSchema, options) {
  if (!unitFormSchema || !Array.isArray(unitFormSchema.sections)) return [];
  const fields = [];
  for (const sec of unitFormSchema.sections) {
    if (!Array.isArray(sec.fields)) continue;
    for (const f of sec.fields) {
      if (f.type === "file") continue;
      if (options?.excludeLockedName && isLockedNameField(f)) continue;
      fields.push({ ...f, sectionTitle: sec.title });
    }
  }
  return fields;
}
function resolveGuardianSummaryFromSchema(student, unitFormSchema) {
  const nonFileFields = getSchemaNonFileFields(unitFormSchema, { excludeLockedName: true });
  let name = "";
  let phone = "";
  for (const f of nonFileFields) {
    const label = (f.label || "").toLowerCase();
    const id = (f.id || "").toLowerCase();
    if (!name && (/nama.?orang.?tua|nama.?wali|nama.?ayah|nama.?ibu/.test(label) || /parentname/.test(id))) {
      const val = resolveFormFieldValue(student, f);
      if (val !== void 0 && val !== null && String(val).trim() !== "") {
        name = String(val).trim();
      }
    }
    if (!phone && (/whatsapp|nomor.?hp|no\.?\s*hp|telepon/.test(label) || /parentphone|phone/.test(id))) {
      const val = resolveFormFieldValue(student, f);
      if (val !== void 0 && val !== null && String(val).trim() !== "") {
        phone = String(val).trim();
      }
    }
  }
  return {
    ...name ? { name } : {},
    ...phone ? { phone } : {}
  };
}
function getActiveAcademicYear(academicYears) {
  if (!Array.isArray(academicYears) || academicYears.length === 0) return null;
  return academicYears.find((a) => a.isActive) || academicYears[0];
}
function getActiveAcademicYearLabel(academicYears) {
  const active = getActiveAcademicYear(academicYears);
  if (active?.year && active.year.trim()) return active.year.trim();
  const y = (/* @__PURE__ */ new Date()).getFullYear();
  return `${y}/${y + 1}`;
}

// server/db.ts
var DB_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
var PROJECT_ROOT = [DB_MODULE_DIR, path.resolve(DB_MODULE_DIR, ".."), process.cwd()].find(
  (dir) => fs.existsSync(path.join(dir, "package.json"))
) || process.cwd();
dotenv.config({ path: path.resolve(PROJECT_ROOT, ".env") });
dotenv.config();
var DATA_DIR = path.resolve(PROJECT_ROOT, "data");
var STORE_FILE = path.join(DATA_DIR, "ppdb_store.json");
var DATA_UPLOADS_DIR = path.resolve(PROJECT_ROOT, "data", "uploads");
var PUBLIC_UPLOADS_DIR = path.resolve(PROJECT_ROOT, "public", "uploads");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_UPLOADS_DIR)) {
  fs.mkdirSync(DATA_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
  fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
}
var PROTECTED_UPLOAD_FILENAMES = /* @__PURE__ */ new Set([
  "logo.png",
  "logo.jpg",
  "favicon.ico",
  "1000828600.png",
  "1000828601.ico",
  "1794360625078_my_new_logo.png",
  "1794415376864_1000828600.png",
  "1794415405520_1000828601.ico"
]);
function extractSafeUploadFilename(rawUrl) {
  if (typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("/uploads/")) return null;
  const withoutQuery = trimmed.slice("/uploads/".length).split(/[?#]/)[0];
  if (!withoutQuery || withoutQuery.includes("/") || withoutQuery.includes("\\") || withoutQuery.includes("..")) {
    return null;
  }
  const safeName = path.basename(withoutQuery);
  if (!safeName || safeName !== withoutQuery || safeName === "." || safeName === "..") {
    return null;
  }
  return safeName;
}
function collectUploadUrlsFromValue(val, out, depth = 0) {
  if (depth > 8 || val === null || val === void 0) return;
  if (typeof val === "string") {
    if (extractSafeUploadFilename(val)) {
      out.add(val.trim());
    }
    return;
  }
  if (Array.isArray(val)) {
    for (const item of val) {
      collectUploadUrlsFromValue(item, out, depth + 1);
    }
    return;
  }
  if (typeof val === "object") {
    for (const entry of Object.values(val)) {
      collectUploadUrlsFromValue(entry, out, depth + 1);
    }
  }
}
function isUploadFilenameStillReferenced(targetFilename) {
  const expectedUrlPrefix = `/uploads/${targetFilename}`;
  const matchesTarget = (raw) => extractSafeUploadFilename(raw) === targetFilename;
  for (const pay of memoryStore.payments || []) {
    if (matchesTarget(pay?.proofUrl)) return true;
  }
  for (const stu of memoryStore.students || []) {
    if (matchesTarget(stu?.avatarUrl)) return true;
    const urls = /* @__PURE__ */ new Set();
    collectUploadUrlsFromValue(stu?.documents, urls);
    collectUploadUrlsFromValue(stu?.dynamicAnswers, urls);
    for (const u of urls) {
      if (extractSafeUploadFilename(u) === targetFilename) return true;
    }
  }
  if (memoryStore.landingConfig) {
    const landingUrls = /* @__PURE__ */ new Set();
    collectUploadUrlsFromValue(
      {
        logoUrl: memoryStore.landingConfig.logoUrl,
        faviconUrl: memoryStore.landingConfig.faviconUrl,
        ogImage: memoryStore.landingConfig.ogImage,
        heroSlides: memoryStore.landingConfig.heroSlides
      },
      landingUrls
    );
    for (const u of landingUrls) {
      if (extractSafeUploadFilename(u) === targetFilename) return true;
    }
  }
  for (const item of memoryStore.trashItems || []) {
    const trashUrls = /* @__PURE__ */ new Set();
    collectUploadUrlsFromValue(item?.snapshot, trashUrls);
    for (const u of trashUrls) {
      if (u.startsWith(expectedUrlPrefix) && extractSafeUploadFilename(u) === targetFilename) return true;
    }
  }
  return false;
}
function deleteUploadFileSafely(fileUrl) {
  const safeName = extractSafeUploadFilename(fileUrl);
  if (!safeName) return false;
  if (PROTECTED_UPLOAD_FILENAMES.has(safeName)) return false;
  if (isUploadFilenameStillReferenced(safeName)) return false;
  let removedAny = false;
  for (const dir of [PUBLIC_UPLOADS_DIR, DATA_UPLOADS_DIR]) {
    const resolved = path.resolve(dir, safeName);
    if (!resolved.startsWith(dir + path.sep)) continue;
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        fs.unlinkSync(resolved);
        removedAny = true;
      }
    } catch (err) {
      console.error(`[UploadsCleanup Error] Gagal menghapus ${resolved}:`, err);
    }
  }
  return removedAny;
}
function saveBufferToUploadsDirs(buffer, prefix, ext) {
  const cleanPrefix = (prefix || "file").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20) || "file";
  const cleanExt = (ext || "bin").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 8) || "bin";
  const safeFilename = `${cleanPrefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}.${cleanExt}`;
  const publicPath = path.resolve(PUBLIC_UPLOADS_DIR, safeFilename);
  const dataPath = path.resolve(DATA_UPLOADS_DIR, safeFilename);
  if (publicPath.startsWith(PUBLIC_UPLOADS_DIR + path.sep)) {
    fs.writeFileSync(publicPath, buffer);
  }
  if (dataPath.startsWith(DATA_UPLOADS_DIR + path.sep)) {
    try {
      fs.writeFileSync(dataPath, buffer);
    } catch (err) {
      console.error("[UploadsSave Error]:", err);
    }
  }
  return `/uploads/${safeFilename}`;
}
var LEGACY_DEFAULT_MASTER_SECRET = "arrisalah-ppdb-master-secret-2026-aceh";
function deriveAes256Key(secretMaterial) {
  return crypto.createHash("sha256").update(secretMaterial).digest();
}
function getEncryptionMasterKey() {
  return deriveAes256Key(
    process.env.APP_ENCRYPTION_KEY || process.env.JWT_SECRET || LEGACY_DEFAULT_MASTER_SECRET
  );
}
function getCandidateDecryptionKeys() {
  const candidates = [
    process.env.APP_ENCRYPTION_KEY,
    process.env.APP_ENCRYPTION_KEY_LEGACY,
    process.env.JWT_SECRET,
    process.env.SESSION_SECRET,
    LEGACY_DEFAULT_MASTER_SECRET
  ].filter((v) => typeof v === "string" && v.trim().length > 0);
  const seen = /* @__PURE__ */ new Set();
  const keys = [];
  for (const material of candidates) {
    const keyBuf = deriveAes256Key(material);
    const hex = keyBuf.toString("hex");
    if (!seen.has(hex)) {
      seen.add(hex);
      keys.push(keyBuf);
    }
  }
  return keys;
}
function encryptSecret(plainText) {
  if (!plainText || plainText.trim() === "") return "";
  if (plainText.startsWith("enc:gcm:")) return plainText;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:gcm:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}
function decryptSecretWithKeyStatus(cipherText) {
  if (!cipherText || cipherText.trim() === "") {
    return { plainText: "", usedLegacyKey: false, ok: true };
  }
  if (!cipherText.startsWith("enc:gcm:")) {
    return { plainText: cipherText, usedLegacyKey: true, ok: true };
  }
  const parts = cipherText.split(":");
  if (parts.length !== 5) {
    return { plainText: "", usedLegacyKey: false, ok: false };
  }
  const iv = Buffer.from(parts[2], "hex");
  const tag = Buffer.from(parts[3], "hex");
  const encryptedData = Buffer.from(parts[4], "hex");
  if (iv.length !== 12 || tag.length !== 16) {
    return { plainText: "", usedLegacyKey: false, ok: false };
  }
  const keys = getCandidateDecryptionKeys();
  for (let i = 0; i < keys.length; i++) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", keys[i], iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      return {
        plainText: decrypted.toString("utf8"),
        usedLegacyKey: i > 0,
        ok: true
      };
    } catch {
    }
  }
  console.warn("[DB] Kredensial terenkripsi tidak dapat didekripsi dengan APP_ENCRYPTION_KEY saat ini.");
  return { plainText: "", usedLegacyKey: false, ok: false };
}
function decryptSecret(cipherText) {
  return decryptSecretWithKeyStatus(cipherText).plainText;
}
var SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var RESET_TOKEN_TTL_MS = 15 * 60 * 1e3;
var RESET_COOLDOWN_MS = 60 * 1e3;
function sanitizeUserForClient(user) {
  const { passwordHash: _omitHash, sessionInvalidatedAt: _omitRevoked, ...safeUser } = user;
  return safeUser;
}
var emailVerificationOtps = /* @__PURE__ */ new Map();
var passwordResetTokens = /* @__PURE__ */ new Map();
var passwordResetCooldowns = /* @__PURE__ */ new Map();
var revokedSessionHashes = /* @__PURE__ */ new Map();
function invalidateUserSessions(userId, email) {
  const now = Date.now();
  const cleanEmail = email ? email.trim().toLowerCase() : "";
  const targetUser = memoryStore.users.find(
    (u) => u.id === userId || cleanEmail && u.email.toLowerCase() === cleanEmail
  );
  if (targetUser) {
    targetUser.sessionInvalidatedAt = now;
  }
  for (const [token, session] of activeSessions.entries()) {
    if (session.user.id === userId || cleanEmail && session.user.email && session.user.email.toLowerCase() === cleanEmail) {
      activeSessions.delete(token);
    }
  }
}
function computeAuditEntryHash(prevHash, log) {
  const payload = `${prevHash}|${log.id}|${log.timestamp}|${log.userEmail}|${log.action}|${log.schoolId}|${log.details}|${log.ipAddress}`;
  return crypto.createHmac("sha256", getEncryptionMasterKey()).update(payload).digest("hex");
}
function safeJsonParse(raw, fallback) {
  if (raw === null || raw === void 0 || raw === "") return fallback;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function formatSqlDate(val, fallback = "") {
  if (!val) return fallback;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : str.slice(0, 10) || fallback;
}
function toSqlDateOrNull(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (!str) return null;
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    return null;
  }
  const dmyMatch = str.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }
  }
  return null;
}
function formatSqlDateTime(val, fallback = "") {
  if (!val) return fallback;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    const hh = String(val.getHours()).padStart(2, "0");
    const mm = String(val.getMinutes()).padStart(2, "0");
    const ss = String(val.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }
  const str = String(val).trim().replace("T", " ");
  const match = str.match(/^(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/);
  return match ? match[1] : str.slice(0, 19) || fallback;
}
var DEFAULT_UNIT_ORDER = {
  TK01: 1,
  SD01: 2,
  SMP01: 3,
  SMA01: 4
};
function sortUnitsList(list) {
  return [...list].map((u) => ({
    ...u,
    sortOrder: typeof u.sortOrder === "number" && Number.isFinite(u.sortOrder) && u.sortOrder > 0 ? u.sortOrder : DEFAULT_UNIT_ORDER[u.id] ?? 99
  })).sort((a, b) => {
    const diff = (a.sortOrder ?? 99) - (b.sortOrder ?? 99);
    if (diff !== 0) return diff;
    return (DEFAULT_UNIT_ORDER[a.id] ?? 99) - (DEFAULT_UNIT_ORDER[b.id] ?? 99);
  });
}
var memoryStore = {
  seedCompleted: false,
  units: INITIAL_UNITS,
  students: INITIAL_STUDENTS,
  payments: INITIAL_PAYMENTS,
  schedules: INITIAL_SCHEDULES,
  formSchemas: INITIAL_FORM_SCHEMAS,
  roles: INITIAL_ROLES,
  users: INITIAL_USERS,
  academicYears: INITIAL_ACADEMIC_YEARS,
  landingConfig: INITIAL_LANDING_CONFIG,
  auditLogs: INITIAL_AUDIT_LOGS,
  systemStatus: INITIAL_SYSTEM_STATUS,
  exportConfigs: INITIAL_EXPORT_CONFIGS,
  smtpConfig: INITIAL_SMTP_CONFIG,
  groupLinkConfigs: INITIAL_GROUP_LINKS,
  cloudflareConfig: INITIAL_CLOUDFLARE_CONFIG,
  unitContacts: INITIAL_UNIT_CONTACTS,
  letterConfigs: INITIAL_LETTER_CONFIGS,
  bankAccounts: INITIAL_BANK_ACCOUNTS,
  trashItems: [],
  passwordResetTokens: [],
  revokedSessionHashes: []
};
if (fs.existsSync(STORE_FILE)) {
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const hasSeededStore = Boolean(parsed.seedCompleted) || Array.isArray(parsed.users) && parsed.users.length > 0 || Array.isArray(parsed.units) && parsed.units.length > 0;
    const startupDefaultHash = bcrypt.hashSync("Coba123*#", 10);
    const loadedUsers = Array.isArray(parsed.users) ? parsed.users.filter((u) => Boolean(u && u.id)).map((u) => ({
      ...u,
      emailVerified: Boolean(u.emailVerified),
      passwordHash: u.passwordHash && String(u.passwordHash).startsWith("$2") ? u.passwordHash : startupDefaultHash
    })) : hasSeededStore ? [] : INITIAL_USERS.map((u) => ({ ...u, passwordHash: startupDefaultHash }));
    const loadedRoles = Array.isArray(parsed.roles) ? parsed.roles.filter((r) => Boolean(r && r.id)) : hasSeededStore ? [] : INITIAL_ROLES;
    const rawFormSchemas = Array.isArray(parsed.formSchemas) && parsed.formSchemas.length > 0 ? parsed.formSchemas.filter((s) => Boolean(s && s.unitId && Array.isArray(s.sections))) : INITIAL_FORM_SCHEMAS;
    const loadedFormSchemas = rawFormSchemas.map((s) => ({
      ...s,
      sections: ensureCoreNameFieldInSections(s.sections, s.unitId)
    }));
    const loadedUnits = sortUnitsList(Array.isArray(parsed.units) && parsed.units.length > 0 ? parsed.units : INITIAL_UNITS).map(
      (u) => ({
        ...u,
        offlineCount: typeof u.offlineCount === "number" && Number.isFinite(u.offlineCount) ? Math.max(0, Math.floor(u.offlineCount)) : 0
      })
    );
    memoryStore = {
      ...memoryStore,
      ...parsed,
      seedCompleted: hasSeededStore,
      units: loadedUnits,
      students: Array.isArray(parsed.students) ? parsed.students : hasSeededStore ? [] : INITIAL_STUDENTS,
      payments: Array.isArray(parsed.payments) ? parsed.payments : hasSeededStore ? [] : INITIAL_PAYMENTS,
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : hasSeededStore ? [] : INITIAL_SCHEDULES,
      academicYears: Array.isArray(parsed.academicYears) ? parsed.academicYears : hasSeededStore ? [] : INITIAL_ACADEMIC_YEARS,
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : hasSeededStore ? [] : INITIAL_AUDIT_LOGS,
      roles: loadedRoles,
      users: loadedUsers,
      formSchemas: loadedFormSchemas,
      landingConfig: parsed.landingConfig && typeof parsed.landingConfig === "object" ? parsed.landingConfig : INITIAL_LANDING_CONFIG,
      exportConfigs: Array.isArray(parsed.exportConfigs) && parsed.exportConfigs.length > 0 ? parsed.exportConfigs : INITIAL_EXPORT_CONFIGS,
      smtpConfig: parsed.smtpConfig || INITIAL_SMTP_CONFIG,
      groupLinkConfigs: Array.isArray(parsed.groupLinkConfigs) && parsed.groupLinkConfigs.length > 0 ? parsed.groupLinkConfigs : INITIAL_GROUP_LINKS,
      cloudflareConfig: {
        ...INITIAL_CLOUDFLARE_CONFIG,
        ...parsed.cloudflareConfig || {},
        enabled: false,
        secretKey: ""
      },
      unitContacts: Array.isArray(parsed.unitContacts) && parsed.unitContacts.length > 0 ? parsed.unitContacts : INITIAL_UNIT_CONTACTS,
      letterConfigs: Array.isArray(parsed.letterConfigs) && parsed.letterConfigs.length > 0 ? parsed.letterConfigs : INITIAL_LETTER_CONFIGS,
      bankAccounts: Array.isArray(parsed.bankAccounts) ? parsed.bankAccounts : INITIAL_BANK_ACCOUNTS,
      trashItems: Array.isArray(parsed.trashItems) ? parsed.trashItems : [],
      passwordResetTokens: Array.isArray(parsed.passwordResetTokens) ? parsed.passwordResetTokens.filter(
        (r) => r && typeof r.tokenHash === "string" && /^[a-f0-9]{64}$/i.test(r.tokenHash) && typeof r.userId === "string" && typeof r.expiresAt === "number" && Date.now() <= r.expiresAt
      ) : [],
      revokedSessionHashes: Array.isArray(parsed.revokedSessionHashes) ? parsed.revokedSessionHashes.filter(
        (r) => r && typeof r.hash === "string" && /^[a-f0-9]{64}$/i.test(r.hash) && typeof r.expiresAt === "number" && Date.now() <= r.expiresAt
      ) : []
    };
    if (Array.isArray(memoryStore.passwordResetTokens)) {
      for (const rec of memoryStore.passwordResetTokens) {
        passwordResetTokens.set(rec.tokenHash, rec);
      }
    }
    if (Array.isArray(memoryStore.revokedSessionHashes)) {
      for (const rec of memoryStore.revokedSessionHashes) {
        revokedSessionHashes.set(rec.hash, rec.expiresAt);
      }
    }
    try {
      if (memoryStore.landingConfig?.customLogoBase64 && memoryStore.landingConfig?.logoUrl) {
        const logoName = path.basename(memoryStore.landingConfig.logoUrl);
        const logoBuf = Buffer.from(
          memoryStore.landingConfig.customLogoBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, ""),
          "base64"
        );
        const targetPath = path.resolve(process.cwd(), "public", "uploads", logoName);
        const dataTargetPath = path.resolve(process.cwd(), "data", "uploads", logoName);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.mkdirSync(path.dirname(dataTargetPath), { recursive: true });
        fs.writeFileSync(targetPath, logoBuf);
        fs.writeFileSync(dataTargetPath, logoBuf);
      }
      if (memoryStore.landingConfig?.customFaviconBase64 && memoryStore.landingConfig?.faviconUrl) {
        const favName = path.basename(memoryStore.landingConfig.faviconUrl);
        const favBuf = Buffer.from(
          memoryStore.landingConfig.customFaviconBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, ""),
          "base64"
        );
        const targetPath = path.resolve(process.cwd(), "public", "uploads", favName);
        const dataTargetPath = path.resolve(process.cwd(), "data", "uploads", favName);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.mkdirSync(path.dirname(dataTargetPath), { recursive: true });
        fs.writeFileSync(targetPath, favBuf);
        fs.writeFileSync(dataTargetPath, favBuf);
      }
    } catch (e) {
    }
    persistStore();
  } catch (err) {
    console.error("[DB] Failed reading local backup store, using initial seed:", err);
  }
} else {
  const initialHash = bcrypt.hashSync("Coba123*#", 10);
  memoryStore.users = INITIAL_USERS.map((u) => ({ ...u, passwordHash: initialHash }));
  memoryStore.units = sortUnitsList(INITIAL_UNITS).map((u) => ({ ...u, offlineCount: 0 }));
  memoryStore.seedCompleted = true;
  fs.writeFileSync(STORE_FILE, JSON.stringify(memoryStore, null, 2), "utf-8");
}
function persistStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(memoryStore, null, 2), "utf-8");
  } catch (err) {
    console.error("[DB] Error writing to persistent store:", err);
  }
}
var mysqlPool = null;
var isMySqlConnected = false;
var mysqlStatusMessage = "Inisialisasi koneksi...";
async function executeMySql(sql, params = []) {
  if (!mysqlPool || !isMySqlConnected) {
    return null;
  }
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [rows] = await mysqlPool.query(sql, params);
      return rows;
    } catch (err) {
      lastError = err;
      const isReset = err?.code === "ECONNRESET" || err?.code === "PROTOCOL_CONNECTION_LOST" || err?.errno === -104 || err?.message?.includes("ECONNRESET");
      if (isReset && attempt < 2) {
        console.warn(`[DB Sync] Connection reset, retrying query (${attempt + 1}/2)...`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      console.error("[DB Sync] MySQL query error:", err?.message || err);
      throw err;
    }
  }
  throw lastError;
}
async function migrateLegacyEncryptedSecrets(syncMySql = false) {
  const cfg = memoryStore.smtpConfig;
  if (!cfg) return;
  let changed = false;
  let nextAuthPassword = cfg.authPassword || "";
  if (nextAuthPassword) {
    const res = decryptSecretWithKeyStatus(nextAuthPassword);
    if (res.ok && res.usedLegacyKey && res.plainText) {
      nextAuthPassword = encryptSecret(res.plainText);
      changed = true;
    }
  }
  let nextAccounts = cfg.accounts;
  if (Array.isArray(cfg.accounts) && cfg.accounts.length > 0) {
    nextAccounts = cfg.accounts.map((acc) => {
      if (!acc || !acc.authPassword) return acc;
      const res = decryptSecretWithKeyStatus(acc.authPassword);
      if (res.ok && res.usedLegacyKey && res.plainText) {
        changed = true;
        return { ...acc, authPassword: encryptSecret(res.plainText) };
      }
      return acc;
    });
  }
  if (changed) {
    memoryStore.smtpConfig = {
      ...cfg,
      authPassword: nextAuthPassword,
      accounts: nextAccounts
    };
    persistStore();
    if (syncMySql && mysqlPool && isMySqlConnected) {
      await executeMySql(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('smtp_config', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [JSON.stringify(memoryStore.smtpConfig)]
      ).catch(() => {
      });
    }
    console.log("[DB] Kredensial SMTP warisan berhasil dimigrasikan ke enkripsi APP_ENCRYPTION_KEY aktif.");
  }
}
async function initDatabase() {
  const host = process.env.MYSQL_HOST || "localhost";
  const port = Number(process.env.MYSQL_PORT) || 3306;
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "ppdb_arrisalah";
  console.log(`[DB] Mencoba menghubungkan ke MySQL di ${host}:${port}/${database}...`);
  try {
    mysqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 4e3,
      dateStrings: true
    });
    const conn = await mysqlPool.getConnection();
    await conn.ping();
    conn.release();
    isMySqlConnected = true;
    mysqlStatusMessage = `Terhubung ke MySQL (${host}:${port}/${database})`;
    console.log(`[DB] Berhasil terhubung ke database MySQL di ${host}:${port}/${database}!`);
    await ensureMySqlTablesExist(mysqlPool);
    console.log("[DB] Skema tabel MySQL terverifikasi & siap.");
    await seedMySqlDatabase();
    await migrateLegacyEncryptedSecrets(true);
  } catch (err) {
    isMySqlConnected = false;
    mysqlStatusMessage = `Koneksi MySQL Standby (Host: ${host}:${port}). Persistent engine aktif.`;
    console.log(`[DB] MySQL notice (${err.message}). Berjalan dengan persistent engine.`);
    await migrateLegacyEncryptedSecrets(false);
  }
}
async function ensureMySqlTablesExist(pool) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS units (
      id VARCHAR(10) NOT NULL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      short_name VARCHAR(20) NOT NULL,
      total_quota INT NOT NULL DEFAULT 100,
      filled_quota INT NOT NULL DEFAULT 0,
      offline_count INT NOT NULL DEFAULT 0,
      form_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      rereg_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      is_open BOOLEAN NOT NULL DEFAULT TRUE,
      closed_notice TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      facilities TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      school_id VARCHAR(10) NOT NULL DEFAULT 'MASTER',
      permissions_json TEXT NOT NULL,
      description TEXT NULL,
      user_count INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      phone VARCHAR(30) NULL,
      school_id VARCHAR(10) NOT NULL DEFAULT 'MASTER',
      role VARCHAR(100) NOT NULL,
      permissions_json TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      children_ids_json TEXT NULL,
      password_hash VARCHAR(255) NULL,
      last_login VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS students (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      registration_number VARCHAR(50) NOT NULL UNIQUE,
      parent_user_id VARCHAR(50) NULL,
      full_name VARCHAR(200) NOT NULL,
      nisn VARCHAR(20) NULL,
      unit VARCHAR(10) NOT NULL,
      gender ENUM('Laki-laki', 'Perempuan') NOT NULL DEFAULT 'Laki-laki',
      birth_place VARCHAR(100) NULL,
      birth_date DATE NULL,
      address TEXT NULL,
      parent_name VARCHAR(150) NULL,
      parent_phone VARCHAR(30) NULL,
      parent_job VARCHAR(100) NULL,
      parent_income VARCHAR(100) NULL,
      status ENUM('verifikasi', 'tes', 'lulus', 'tidak_lulus', 'terdaftar') NOT NULL DEFAULT 'verifikasi',
      registered_at DATETIME NOT NULL,
      documents_json LONGTEXT NULL,
      dynamic_answers_json LONGTEXT NULL,
      verification_notes TEXT NULL,
      test_score INT NULL,
      test_schedule_id VARCHAR(50) NULL,
      test_published BOOLEAN NOT NULL DEFAULT FALSE,
      is_offline BOOLEAN NOT NULL DEFAULT FALSE,
      track VARCHAR(50) NULL,
      school_origin VARCHAR(150) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_parent_user (parent_user_id),
      INDEX idx_unit (unit),
      INDEX idx_status (status),
      INDEX idx_reg_num (registration_number),
      CONSTRAINT fk_students_parent_user FOREIGN KEY (parent_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      registration_id VARCHAR(50) NOT NULL,
      registration_number VARCHAR(50) NOT NULL,
      student_name VARCHAR(150) NOT NULL,
      unit VARCHAR(10) NOT NULL,
      type ENUM('Formulir', 'Daftar Ulang') NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status ENUM('pending', 'verifikasi', 'lunas', 'ditolak') NOT NULL DEFAULT 'pending',
      payment_date DATETIME NOT NULL,
      proof_url LONGTEXT NULL,
      verified_by VARCHAR(150) NULL,
      verification_notes TEXT NULL,
      bank_account VARCHAR(150) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reg_id (registration_id),
      INDEX idx_pay_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS test_schedules (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      title VARCHAR(150) NOT NULL,
      unit VARCHAR(10) NOT NULL,
      test_date DATE NOT NULL,
      start_time VARCHAR(10) NOT NULL,
      end_time VARCHAR(10) NOT NULL,
      room VARCHAR(100) NOT NULL,
      examiner VARCHAR(150) NOT NULL,
      quota INT NOT NULL DEFAULT 40,
      filled INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS form_schemas (
      unit_id VARCHAR(10) NOT NULL PRIMARY KEY,
      sections_json LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS academic_years (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      year_label VARCHAR(50) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT FALSE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS landing_config (
      id INT NOT NULL PRIMARY KEY DEFAULT 1,
      app_name VARCHAR(100) NOT NULL,
      app_tagline VARCHAR(150) NULL,
      hero_title TEXT NOT NULL,
      hero_subtitle TEXT NOT NULL,
      stats_total INT NOT NULL DEFAULT 800,
      flow_steps_json LONGTEXT NOT NULL,
      requirements_json LONGTEXT NOT NULL,
      contact_json LONGTEXT NOT NULL,
      hero_slides_json LONGTEXT NULL,
      logo_url TEXT NULL,
      favicon_url TEXT NULL,
      help_title VARCHAR(255) NULL,
      help_subtitle TEXT NULL,
      full_config_json LONGTEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      timestamp_str VARCHAR(30) NOT NULL,
      user_email VARCHAR(150) NOT NULL,
      action VARCHAR(50) NOT NULL,
      school_id VARCHAR(10) NOT NULL,
      details TEXT NOT NULL,
      ip_address VARCHAR(50) NOT NULL,
      prev_hash VARCHAR(64) NULL,
      entry_hash VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_timestamp (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(50) NOT NULL PRIMARY KEY,
      setting_value LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE IF NOT EXISTS trash_items (
      id VARCHAR(80) NOT NULL PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(120) NOT NULL,
      unit_id VARCHAR(20) NOT NULL DEFAULT 'MASTER',
      title VARCHAR(255) NOT NULL,
      subtitle VARCHAR(255) NULL,
      deleted_at VARCHAR(40) NOT NULL,
      deleted_by VARCHAR(150) NOT NULL,
      deleted_by_role VARCHAR(100) NULL,
      snapshot_json LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_entity_type (entity_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];
  for (const tableSql of tables) {
    try {
      await pool.query(tableSql);
    } catch (err) {
      console.error("[DB Schema Error]:", err.message);
    }
  }
  const migrations = [
    "ALTER TABLE units ADD COLUMN is_open BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE units ADD COLUMN closed_notice TEXT NULL",
    "ALTER TABLE units ADD COLUMN sort_order INT NOT NULL DEFAULT 0",
    "ALTER TABLE units ADD COLUMN offline_count INT NOT NULL DEFAULT 0",
    "ALTER TABLE landing_config ADD COLUMN hero_slides_json LONGTEXT NULL",
    "ALTER TABLE landing_config ADD COLUMN app_tagline VARCHAR(150) NULL",
    "ALTER TABLE landing_config ADD COLUMN logo_url TEXT NULL",
    "ALTER TABLE landing_config ADD COLUMN favicon_url TEXT NULL",
    "ALTER TABLE landing_config ADD COLUMN help_title VARCHAR(255) NULL",
    "ALTER TABLE landing_config ADD COLUMN help_subtitle TEXT NULL",
    "ALTER TABLE landing_config ADD COLUMN full_config_json LONGTEXT NULL",
    "ALTER TABLE students ADD COLUMN parent_user_id VARCHAR(50) NULL AFTER registration_number",
    "ALTER TABLE students ADD COLUMN documents_json LONGTEXT NULL AFTER registered_at",
    "ALTER TABLE students ADD COLUMN dynamic_answers_json LONGTEXT NULL AFTER documents_json",
    "ALTER TABLE students ADD COLUMN is_offline BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE students ADD COLUMN track VARCHAR(50) NULL",
    "ALTER TABLE students ADD COLUMN school_origin VARCHAR(150) NULL",
    "ALTER TABLE students ADD INDEX idx_parent_user (parent_user_id)",
    "ALTER TABLE students MODIFY COLUMN full_name VARCHAR(200) NOT NULL",
    "ALTER TABLE students MODIFY COLUMN birth_place VARCHAR(100) NULL",
    "ALTER TABLE students MODIFY COLUMN birth_date DATE NULL",
    "ALTER TABLE students MODIFY COLUMN parent_name VARCHAR(150) NULL",
    "ALTER TABLE students MODIFY COLUMN parent_phone VARCHAR(30) NULL",
    "ALTER TABLE students MODIFY COLUMN parent_income VARCHAR(100) NULL",
    "ALTER TABLE payments MODIFY COLUMN proof_url LONGTEXT NULL",
    "ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN children_ids_json TEXT NULL",
    "ALTER TABLE audit_logs ADD COLUMN prev_hash VARCHAR(64) NULL",
    "ALTER TABLE audit_logs ADD COLUMN entry_hash VARCHAR(64) NULL"
  ];
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (e) {
      if (e?.errno !== 1060 && e?.errno !== 1061 && e?.code !== "ER_DUP_FIELDNAME" && e?.code !== "ER_DUP_KEYNAME") {
        console.warn("[DB Migration Notice]:", e?.message);
      }
    }
  }
}
async function seedMySqlDatabase() {
  if (!mysqlPool || !isMySqlConnected) return;
  try {
    const defaultPasswordHash = bcrypt.hashSync("Coba123*#", 10);
    const [allSettingsRows] = await mysqlPool.query("SELECT setting_key, setting_value FROM system_settings");
    const settingsMap = /* @__PURE__ */ new Map();
    if (Array.isArray(allSettingsRows)) {
      allSettingsRows.forEach((row) => {
        if (row && row.setting_key) {
          settingsMap.set(String(row.setting_key), String(row.setting_value || ""));
        }
      });
    }
    const [existingRoles] = await mysqlPool.query("SELECT * FROM roles");
    const [existingUsers] = await mysqlPool.query("SELECT * FROM users");
    const [existingUnits] = await mysqlPool.query("SELECT * FROM units");
    const [existingStudents] = await mysqlPool.query("SELECT * FROM students");
    const [existingPayments] = await mysqlPool.query("SELECT * FROM payments");
    const [existingSchedules] = await mysqlPool.query("SELECT * FROM test_schedules");
    const [existingSchemas] = await mysqlPool.query("SELECT * FROM form_schemas");
    const [existingYears] = await mysqlPool.query("SELECT * FROM academic_years");
    const [existingLanding] = await mysqlPool.query("SELECT * FROM landing_config WHERE id = 1");
    const [existingAuditLogs] = await mysqlPool.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500");
    const [existingTrash] = await mysqlPool.query("SELECT * FROM trash_items ORDER BY created_at DESC LIMIT 1000");
    const hasSeedMarker = settingsMap.get("initial_seed_completed") === "true";
    const hasCoreRows = Array.isArray(existingUsers) && existingUsers.length > 0 || Array.isArray(existingUnits) && existingUnits.length > 0 || Array.isArray(existingRoles) && existingRoles.length > 0 || Array.isArray(existingStudents) && existingStudents.length > 0 || Array.isArray(existingLanding) && existingLanding.length > 0;
    const isExistingDatabase = hasSeedMarker || hasCoreRows;
    if (isExistingDatabase) {
      console.log("[DB] Database produksi terdeteksi \u2014 memuat data asli dari MySQL tanpa menimpa data seed.");
      if (!hasSeedMarker) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('initial_seed_completed', 'true')"
        );
      }
    } else {
      console.log("[DB] Database baru & kosong terdeteksi \u2014 menjalankan inisialisasi seed awal satu kali...");
    }
    if (Array.isArray(existingRoles) && (existingRoles.length > 0 || isExistingDatabase)) {
      memoryStore.roles = existingRoles.map((r) => ({
        id: r.id,
        name: r.name,
        schoolId: r.school_id,
        permissions: safeJsonParse(r.permissions_json, []),
        description: r.description || "",
        userCount: Number(r.user_count) || 0
      }));
    } else {
      for (const r of INITIAL_ROLES) {
        await mysqlPool.query(
          `INSERT IGNORE INTO roles (id, name, school_id, permissions_json, description, user_count)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [r.id, r.name, r.schoolId, JSON.stringify(r.permissions || []), r.description || "", r.userCount || 0]
        );
      }
      memoryStore.roles = INITIAL_ROLES;
    }
    if (Array.isArray(existingUsers) && (existingUsers.length > 0 || isExistingDatabase)) {
      console.log(`[DB] Memuat ${existingUsers.length} pengguna langsung dari MySQL (tanpa overwrite seed).`);
      memoryStore.users = existingUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        schoolId: u.school_id || "MASTER",
        role: u.role,
        permissions: safeJsonParse(u.permissions_json, []),
        isActive: Boolean(u.is_active),
        emailVerified: Boolean(u.email_verified),
        childrenIds: safeJsonParse(u.children_ids_json, []),
        lastLogin: u.last_login || "-",
        passwordHash: u.password_hash || defaultPasswordHash
      }));
    } else {
      for (const u of INITIAL_USERS) {
        await mysqlPool.query(
          `INSERT IGNORE INTO users (id, name, email, phone, school_id, role, permissions_json, is_active, email_verified, children_ids_json, password_hash, last_login)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            u.id,
            u.name,
            u.email,
            u.phone || "",
            u.schoolId || "MASTER",
            u.role,
            JSON.stringify(u.permissions || []),
            u.isActive ? 1 : 0,
            u.emailVerified ? 1 : 0,
            JSON.stringify(u.childrenIds || []),
            defaultPasswordHash,
            u.lastLogin || null
          ]
        );
      }
      memoryStore.users = INITIAL_USERS.map((u) => ({ ...u, passwordHash: defaultPasswordHash }));
    }
    if (Array.isArray(existingUnits) && existingUnits.length > 0) {
      memoryStore.units = sortUnitsList(
        existingUnits.map((un) => ({
          id: un.id,
          name: un.name,
          shortName: un.short_name,
          totalQuota: Number(un.total_quota) || 100,
          filledQuota: Number(un.filled_quota) || 0,
          offlineCount: Math.max(0, Number(un.offline_count) || 0),
          formFee: Number(un.form_fee) || 0,
          reRegFee: Number(un.rereg_fee) || 0,
          isOpen: un.is_open !== void 0 && un.is_open !== null ? Boolean(un.is_open) : true,
          closedNotice: un.closed_notice || void 0,
          sortOrder: Number(un.sort_order) > 0 ? Number(un.sort_order) : DEFAULT_UNIT_ORDER[un.id] ?? 99,
          facilities: safeJsonParse(un.facilities, [])
        }))
      );
    } else {
      for (const un of INITIAL_UNITS) {
        const orderVal = un.sortOrder ?? DEFAULT_UNIT_ORDER[un.id] ?? 99;
        await mysqlPool.query(
          `INSERT IGNORE INTO units (id, name, short_name, total_quota, filled_quota, offline_count, form_fee, rereg_fee, is_open, closed_notice, sort_order, facilities)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            un.id,
            un.name,
            un.shortName,
            un.totalQuota,
            un.filledQuota,
            0,
            un.formFee,
            un.reRegFee,
            un.isOpen !== false ? 1 : 0,
            un.closedNotice || null,
            orderVal,
            JSON.stringify(un.facilities || [])
          ]
        );
      }
      memoryStore.units = sortUnitsList(INITIAL_UNITS).map((u) => ({ ...u, offlineCount: 0 }));
    }
    if (Array.isArray(existingStudents) && (existingStudents.length > 0 || isExistingDatabase)) {
      memoryStore.students = existingStudents.map((s) => {
        const parsedDocs = safeJsonParse(s.documents_json, {});
        const mergedDocs = {};
        if (parsedDocs.kk || s.kk_document) mergedDocs.kk = parsedDocs.kk || s.kk_document;
        if (parsedDocs.akta || s.akta_document) mergedDocs.akta = parsedDocs.akta || s.akta_document;
        if (parsedDocs.photo || s.photo_document) mergedDocs.photo = parsedDocs.photo || s.photo_document;
        if (parsedDocs.rapor || s.rapor_document) mergedDocs.rapor = parsedDocs.rapor || s.rapor_document;
        if (parsedDocs.ijazah || s.ijazah_document) mergedDocs.ijazah = parsedDocs.ijazah || s.ijazah_document;
        Object.keys(parsedDocs).forEach((k) => {
          if (parsedDocs[k] !== void 0 && parsedDocs[k] !== "" && mergedDocs[k] === void 0) {
            mergedDocs[k] = parsedDocs[k];
          }
        });
        return {
          id: s.id,
          registrationNumber: s.registration_number,
          parentUserId: s.parent_user_id || void 0,
          fullName: s.full_name,
          nisn: s.nisn || void 0,
          unit: s.unit,
          gender: s.gender || "Laki-laki",
          birthPlace: s.birth_place || "",
          birthDate: formatSqlDate(s.birth_date, ""),
          address: s.address || "",
          parentName: s.parent_name || "",
          parentPhone: s.parent_phone || "",
          parentJob: s.parent_job || "",
          parentIncome: s.parent_income || "",
          status: s.status,
          registeredAt: formatSqlDateTime(s.registered_at),
          documents: mergedDocs,
          dynamicAnswers: safeJsonParse(s.dynamic_answers_json, {}),
          verificationNotes: s.verification_notes || void 0,
          testScore: s.test_score !== null && s.test_score !== void 0 ? Number(s.test_score) : void 0,
          testScheduleId: s.test_schedule_id || void 0,
          testPublished: Boolean(s.test_published),
          isOffline: s.is_offline !== void 0 ? Boolean(s.is_offline) : false,
          track: s.track || void 0,
          schoolOrigin: s.school_origin || void 0
        };
      });
    } else {
      for (const s of INITIAL_STUDENTS) {
        await mysqlPool.query(
          `INSERT IGNORE INTO students (id, registration_number, parent_user_id, full_name, nisn, unit, gender, birth_place, birth_date, address, parent_name, parent_phone, parent_job, parent_income, status, registered_at, documents_json, dynamic_answers_json, verification_notes, test_score, test_schedule_id, test_published, is_offline, track, school_origin)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.registrationNumber,
            s.parentUserId || null,
            s.fullName.slice(0, 200),
            s.nisn || null,
            s.unit,
            s.gender || "Laki-laki",
            (s.birthPlace || "").trim().slice(0, 100),
            toSqlDateOrNull(s.birthDate),
            s.address || "",
            (s.parentName || "").trim().slice(0, 150),
            (s.parentPhone || "").trim().slice(0, 30),
            (s.parentJob || "").trim().slice(0, 100),
            (s.parentIncome || "").trim().slice(0, 100),
            s.status,
            s.registeredAt || (/* @__PURE__ */ new Date()).toISOString().substring(0, 19).replace("T", " "),
            JSON.stringify(s.documents || {}),
            JSON.stringify(s.dynamicAnswers || {}),
            s.verificationNotes || null,
            s.testScore ?? null,
            s.testScheduleId || null,
            s.testPublished ? 1 : 0,
            s.isOffline ? 1 : 0,
            s.track || null,
            s.schoolOrigin || null
          ]
        );
      }
      memoryStore.students = INITIAL_STUDENTS;
    }
    if (Array.isArray(existingPayments) && (existingPayments.length > 0 || isExistingDatabase)) {
      memoryStore.payments = existingPayments.map((p) => ({
        id: p.id,
        registrationId: p.registration_id,
        registrationNumber: p.registration_number,
        studentName: p.student_name,
        unit: p.unit,
        type: p.type,
        amount: Number(p.amount) || 0,
        status: p.status,
        date: formatSqlDateTime(p.payment_date),
        proofUrl: p.proof_url || "",
        verifiedBy: p.verified_by || void 0,
        verificationNotes: p.verification_notes || void 0,
        bankAccount: p.bank_account || ""
      }));
    } else {
      for (const p of INITIAL_PAYMENTS) {
        await mysqlPool.query(
          `INSERT IGNORE INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, proof_url, verified_by, verification_notes, bank_account)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.registrationId,
            p.registrationNumber,
            p.studentName,
            p.unit,
            p.type,
            p.amount,
            p.status,
            p.date || (/* @__PURE__ */ new Date()).toISOString().substring(0, 19).replace("T", " "),
            p.proofUrl || null,
            p.verifiedBy || null,
            p.verificationNotes || null,
            p.bankAccount || ""
          ]
        );
      }
      memoryStore.payments = INITIAL_PAYMENTS;
    }
    if (Array.isArray(existingSchedules) && (existingSchedules.length > 0 || isExistingDatabase)) {
      memoryStore.schedules = existingSchedules.map((sc) => ({
        id: sc.id,
        title: sc.title,
        unit: sc.unit,
        date: formatSqlDate(sc.test_date),
        startTime: sc.start_time,
        endTime: sc.end_time,
        room: sc.room,
        examiner: sc.examiner,
        quota: Number(sc.quota) || 40,
        filled: Number(sc.filled) || 0
      }));
    } else {
      for (const sc of INITIAL_SCHEDULES) {
        await mysqlPool.query(
          `INSERT IGNORE INTO test_schedules (id, title, unit, test_date, start_time, end_time, room, examiner, quota, filled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sc.id, sc.title, sc.unit, sc.date, sc.startTime, sc.endTime, sc.room, sc.examiner, sc.quota, sc.filled]
        );
      }
      memoryStore.schedules = INITIAL_SCHEDULES;
    }
    const existingSchemaMap = /* @__PURE__ */ new Map();
    if (Array.isArray(existingSchemas)) {
      existingSchemas.forEach((fsItem) => {
        if (fsItem && fsItem.unit_id) {
          existingSchemaMap.set(fsItem.unit_id, fsItem);
        }
      });
    }
    const mergedSchemaMap = /* @__PURE__ */ new Map();
    for (const [unitId, existing] of existingSchemaMap.entries()) {
      const parsedSections = safeJsonParse(existing.sections_json, null);
      if (Array.isArray(parsedSections) && (parsedSections.length > 0 || isExistingDatabase)) {
        mergedSchemaMap.set(unitId, {
          unitId,
          sections: parsedSections
        });
      }
    }
    for (const defaultSchema of INITIAL_FORM_SCHEMAS) {
      if (!mergedSchemaMap.has(defaultSchema.unitId)) {
        await mysqlPool.query(
          `INSERT INTO form_schemas (unit_id, sections_json)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE sections_json = VALUES(sections_json)`,
          [defaultSchema.unitId, JSON.stringify(defaultSchema.sections || [])]
        );
        mergedSchemaMap.set(defaultSchema.unitId, defaultSchema);
      }
    }
    const unitOrder = new Map(memoryStore.units.map((u, idx) => [u.id, idx]));
    memoryStore.formSchemas = Array.from(mergedSchemaMap.values()).map((s) => ({
      ...s,
      sections: ensureCoreNameFieldInSections(s.sections, s.unitId)
    })).sort((a, b) => (unitOrder.get(a.unitId) ?? 999) - (unitOrder.get(b.unitId) ?? 999));
    if (Array.isArray(existingYears) && (existingYears.length > 0 || isExistingDatabase)) {
      memoryStore.academicYears = existingYears.map((ay) => ({
        id: ay.id,
        year: ay.year_label,
        startDate: formatSqlDate(ay.start_date, "2026-07-01"),
        endDate: formatSqlDate(ay.end_date, "2027-06-30"),
        isActive: Boolean(ay.is_active)
      }));
    } else {
      for (const ay of INITIAL_ACADEMIC_YEARS) {
        await mysqlPool.query(
          `INSERT IGNORE INTO academic_years (id, year_label, start_date, end_date, is_active)
           VALUES (?, ?, ?, ?, ?)`,
          [ay.id, ay.year || ay.yearLabel || "2026/2027", ay.startDate, ay.endDate, ay.isActive ? 1 : 0]
        );
      }
      memoryStore.academicYears = INITIAL_ACADEMIC_YEARS;
    }
    if (Array.isArray(existingLanding) && existingLanding.length > 0) {
      const row = existingLanding[0];
      const fullConfig = safeJsonParse(row.full_config_json, {});
      const parsedFlowSteps = safeJsonParse(row.flow_steps_json, void 0);
      const parsedRequirements = safeJsonParse(row.requirements_json, void 0);
      const parsedContact = safeJsonParse(row.contact_json, void 0);
      const parsedHeroSlides = row.hero_slides_json ? safeJsonParse(row.hero_slides_json, void 0) : void 0;
      memoryStore.landingConfig = {
        ...INITIAL_LANDING_CONFIG,
        ...fullConfig,
        appName: row.app_name ?? fullConfig.appName ?? INITIAL_LANDING_CONFIG.appName,
        appTagline: row.app_tagline ?? fullConfig.appTagline ?? INITIAL_LANDING_CONFIG.appTagline,
        heroTitle: row.hero_title ?? fullConfig.heroTitle ?? INITIAL_LANDING_CONFIG.heroTitle,
        heroSubtitle: row.hero_subtitle ?? fullConfig.heroSubtitle ?? INITIAL_LANDING_CONFIG.heroSubtitle,
        statsTotal: row.stats_total !== null && row.stats_total !== void 0 ? Number(row.stats_total) : fullConfig.statsTotal ?? INITIAL_LANDING_CONFIG.statsTotal,
        flowSteps: Array.isArray(parsedFlowSteps) ? parsedFlowSteps : fullConfig.flowSteps ?? INITIAL_LANDING_CONFIG.flowSteps,
        requirements: Array.isArray(parsedRequirements) ? parsedRequirements : fullConfig.requirements ?? INITIAL_LANDING_CONFIG.requirements,
        contact: parsedContact && typeof parsedContact === "object" ? parsedContact : fullConfig.contact ?? INITIAL_LANDING_CONFIG.contact,
        heroSlides: Array.isArray(parsedHeroSlides) ? parsedHeroSlides : Array.isArray(fullConfig.heroSlides) ? fullConfig.heroSlides : INITIAL_LANDING_CONFIG.heroSlides,
        logoUrl: row.logo_url ?? fullConfig.logoUrl ?? INITIAL_LANDING_CONFIG.logoUrl,
        faviconUrl: row.favicon_url ?? fullConfig.faviconUrl ?? INITIAL_LANDING_CONFIG.faviconUrl,
        helpTitle: row.help_title ?? fullConfig.helpTitle ?? INITIAL_LANDING_CONFIG.helpTitle,
        helpSubtitle: row.help_subtitle ?? fullConfig.helpSubtitle ?? INITIAL_LANDING_CONFIG.helpSubtitle
      };
      if (!row.full_config_json) {
        await mysqlPool.query("UPDATE landing_config SET full_config_json = ? WHERE id = 1", [JSON.stringify(memoryStore.landingConfig)]).catch(() => {
        });
      }
    } else {
      await mysqlPool.query(
        `INSERT IGNORE INTO landing_config (id, app_name, app_tagline, hero_title, hero_subtitle, stats_total, flow_steps_json, requirements_json, contact_json, hero_slides_json, logo_url, favicon_url, help_title, help_subtitle, full_config_json)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          INITIAL_LANDING_CONFIG.appName,
          INITIAL_LANDING_CONFIG.appTagline || "Yayasan Ar-Risalah Aceh",
          INITIAL_LANDING_CONFIG.heroTitle,
          INITIAL_LANDING_CONFIG.heroSubtitle,
          INITIAL_LANDING_CONFIG.statsTotal || 826,
          JSON.stringify(INITIAL_LANDING_CONFIG.flowSteps || []),
          JSON.stringify(INITIAL_LANDING_CONFIG.requirements || []),
          JSON.stringify(INITIAL_LANDING_CONFIG.contact || {}),
          JSON.stringify(INITIAL_LANDING_CONFIG.heroSlides || []),
          INITIAL_LANDING_CONFIG.logoUrl || "/uploads/logo.png",
          INITIAL_LANDING_CONFIG.faviconUrl || "/uploads/favicon.ico",
          INITIAL_LANDING_CONFIG.helpTitle || null,
          INITIAL_LANDING_CONFIG.helpSubtitle || null,
          JSON.stringify(INITIAL_LANDING_CONFIG)
        ]
      );
      memoryStore.landingConfig = INITIAL_LANDING_CONFIG;
    }
    try {
      const smtpRaw = settingsMap.get("smtp_config");
      if (smtpRaw) {
        const parsed = safeJsonParse(smtpRaw, {});
        if (parsed && typeof parsed === "object") {
          memoryStore.smtpConfig = { ...INITIAL_SMTP_CONFIG, ...parsed };
        }
      } else {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('smtp_config', ?)",
          [JSON.stringify(memoryStore.smtpConfig)]
        );
      }
    } catch (e) {
      console.warn("[DB] Notice syncing smtp_config:", e.message);
    }
    try {
      const cfRaw = settingsMap.get("cloudflare_config");
      if (cfRaw) {
        const parsed = safeJsonParse(cfRaw, {});
        if (parsed && typeof parsed === "object") {
          memoryStore.cloudflareConfig = { ...INITIAL_CLOUDFLARE_CONFIG, ...parsed };
        }
      } else if (memoryStore.cloudflareConfig) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('cloudflare_config', ?)",
          [JSON.stringify(memoryStore.cloudflareConfig)]
        );
      }
      if (memoryStore.cloudflareConfig?.secretKey) {
        const nextCf = {
          ...memoryStore.cloudflareConfig || INITIAL_CLOUDFLARE_CONFIG,
          enabled: false,
          secretKey: "",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: "System (.env)"
        };
        memoryStore.cloudflareConfig = nextCf;
        await mysqlPool.query(
          "INSERT INTO system_settings (setting_key, setting_value) VALUES ('cloudflare_config', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
          [JSON.stringify(nextCf)]
        );
        persistStore();
      }
    } catch (e) {
      console.warn("[DB] Notice syncing cloudflare_config:", e.message);
    }
    try {
      const ucRaw = settingsMap.get("unit_contacts");
      if (ucRaw) {
        const parsed = safeJsonParse(ucRaw, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryStore.unitContacts = parsed;
        }
      } else if (memoryStore.unitContacts) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('unit_contacts', ?)",
          [JSON.stringify(memoryStore.unitContacts)]
        );
      }
    } catch (e) {
      console.warn("[DB] Notice syncing unit_contacts:", e.message);
    }
    try {
      const glRaw = settingsMap.get("group_links");
      if (glRaw) {
        const parsed = safeJsonParse(glRaw, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryStore.groupLinkConfigs = parsed;
        }
      } else if (memoryStore.groupLinkConfigs) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('group_links', ?)",
          [JSON.stringify(memoryStore.groupLinkConfigs)]
        );
      }
    } catch (e) {
      console.warn("[DB] Notice syncing group_links:", e.message);
    }
    try {
      const lcRaw = settingsMap.get("letter_configs");
      if (lcRaw) {
        const parsed = safeJsonParse(lcRaw, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryStore.letterConfigs = parsed;
        }
      } else if (memoryStore.letterConfigs) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_configs', ?)",
          [JSON.stringify(memoryStore.letterConfigs)]
        );
      }
    } catch (e) {
      console.warn("[DB] Notice syncing letter_configs:", e.message);
    }
    try {
      const baRaw = settingsMap.get("bank_accounts");
      if (baRaw) {
        const parsed = safeJsonParse(baRaw, []);
        if (Array.isArray(parsed)) {
          memoryStore.bankAccounts = parsed;
        }
      } else if (memoryStore.bankAccounts) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('bank_accounts', ?)",
          [JSON.stringify(memoryStore.bankAccounts)]
        );
      }
    } catch (e) {
      console.warn("[DB] Notice syncing bank_accounts:", e.message);
    }
    try {
      const expRaw = settingsMap.get("export_configs");
      if (expRaw) {
        const parsed = safeJsonParse(expRaw, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryStore.exportConfigs = parsed;
        }
      } else if (memoryStore.exportConfigs) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('export_configs', ?)",
          [JSON.stringify(memoryStore.exportConfigs)]
        );
      }
    } catch (e) {
      console.warn("[DB] Notice syncing export_configs:", e.message);
    }
    if (Array.isArray(existingAuditLogs) && existingAuditLogs.length > 0) {
      memoryStore.auditLogs = existingAuditLogs.map((l) => ({
        id: l.id,
        timestamp: l.timestamp_str,
        userEmail: l.user_email,
        action: l.action,
        schoolId: l.school_id,
        details: l.details,
        ipAddress: l.ip_address,
        ...l.prev_hash ? { prevHash: l.prev_hash } : {},
        ...l.entry_hash ? { entryHash: l.entry_hash } : {}
      }));
    } else if (isExistingDatabase) {
      memoryStore.auditLogs = [];
    }
    if (Array.isArray(existingTrash)) {
      memoryStore.trashItems = existingTrash.map((tr) => ({
        id: tr.id,
        entityType: tr.entity_type,
        entityId: tr.entity_id,
        unitId: tr.unit_id || "MASTER",
        title: tr.title,
        subtitle: tr.subtitle || void 0,
        deletedAt: tr.deleted_at,
        deletedBy: tr.deleted_by,
        deletedByRole: tr.deleted_by_role || void 0,
        snapshot: safeJsonParse(tr.snapshot_json, {})
      }));
    }
    memoryStore.users = memoryStore.users.map((u) => {
      const existingChildIds = Array.isArray(u.childrenIds) ? u.childrenIds : [];
      const linkedStudents = memoryStore.students.filter(
        (s) => s.parentUserId === u.id || existingChildIds.includes(s.id)
      );
      if (linkedStudents.length === 0) {
        return u;
      }
      const mergedChildIds = Array.from(/* @__PURE__ */ new Set([...existingChildIds, ...linkedStudents.map((s) => s.id)]));
      const firstStudent = linkedStudents[0];
      return {
        ...u,
        childrenIds: mergedChildIds,
        studentId: u.studentId || firstStudent.id,
        studentRegistrationNumber: u.studentRegistrationNumber || firstStudent.registrationNumber
      };
    });
    await mysqlPool.query(
      "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('initial_seed_completed', 'true')"
    );
    memoryStore.seedCompleted = true;
    persistStore();
    console.log("[DB] Sinkronisasi database MySQL selesai (Mode Production-Safe aktif).");
  } catch (err) {
    console.error("[DB Sync Error]: Gagal sinkronisasi data dengan MySQL:", err.message);
  }
}
async function addAuditLog(action, schoolId, details, userEmail = "admin@arrisalahaceh.or.id", ipAddress = "127.0.0.1") {
  const now = /* @__PURE__ */ new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const prevHash = memoryStore.auditLogs[0]?.entryHash || "GENESIS";
  const baseLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    timestamp: timeStr,
    userEmail,
    action,
    schoolId,
    details,
    ipAddress
  };
  const entryHash = computeAuditEntryHash(prevHash, baseLog);
  const log = {
    ...baseLog,
    prevHash,
    entryHash
  };
  memoryStore.auditLogs.unshift(log);
  if (memoryStore.auditLogs.length > 500) {
    memoryStore.auditLogs = memoryStore.auditLogs.slice(0, 500);
  }
  persistStore();
  if (mysqlPool && isMySqlConnected) {
    const pushToMySql = async (retryCount = 0) => {
      try {
        await mysqlPool.query(
          "INSERT INTO audit_logs (id, timestamp_str, user_email, action, school_id, details, ip_address, prev_hash, entry_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [log.id, log.timestamp, log.userEmail, log.action, log.schoolId, log.details, log.ipAddress, log.prevHash || null, log.entryHash || null]
        );
      } catch (e) {
        if ((e?.code === "ECONNRESET" || e?.message?.includes("ECONNRESET") || e?.errno === -104) && retryCount < 2) {
          console.warn(`[DB Sync] Connection reset, retrying audit log save (${retryCount + 1})...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          return pushToMySql(retryCount + 1);
        } else if (e?.code === "ER_NO_SUCH_TABLE") {
          console.log("[DB Sync] Table audit_logs missing. Auto-creating...");
          try {
            await mysqlPool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
              id VARCHAR(50) NOT NULL PRIMARY KEY,
              timestamp_str VARCHAR(30) NOT NULL,
              user_email VARCHAR(150) NOT NULL,
              action VARCHAR(50) NOT NULL,
              school_id VARCHAR(10) NOT NULL,
              details TEXT NOT NULL,
              ip_address VARCHAR(50) NOT NULL,
              prev_hash VARCHAR(64) NULL,
              entry_hash VARCHAR(64) NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_timestamp (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
            return pushToMySql(retryCount + 1);
          } catch (retryErr) {
            console.error("[DB Sync] Failed to create audit_logs table:", retryErr);
          }
        } else {
          console.error("[DB Sync] Error saving audit log to MySQL:", e.message);
        }
      }
    };
    pushToMySql();
  }
  return log;
}
async function archiveToTrash(params) {
  const now = /* @__PURE__ */ new Date();
  const deletedAt = formatSqlDateTime(now, now.toISOString().slice(0, 19).replace("T", " "));
  const item = {
    id: `trash-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    entityType: params.entityType,
    entityId: String(params.entityId || ""),
    unitId: params.unitId || "MASTER",
    title: String(params.title || "Data Terhapus").slice(0, 250),
    subtitle: params.subtitle ? String(params.subtitle).slice(0, 250) : void 0,
    deletedAt,
    deletedBy: String(params.deletedBy || "Admin").slice(0, 145),
    deletedByRole: params.deletedByRole ? String(params.deletedByRole).slice(0, 95) : void 0,
    snapshot: params.snapshot ?? {}
  };
  if (mysqlPool && isMySqlConnected) {
    try {
      await mysqlPool.query(
        `INSERT INTO trash_items (id, entity_type, entity_id, unit_id, title, subtitle, deleted_at, deleted_by, deleted_by_role, snapshot_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.entityType,
          item.entityId,
          item.unitId,
          item.title,
          item.subtitle || null,
          item.deletedAt,
          item.deletedBy,
          item.deletedByRole || null,
          JSON.stringify(item.snapshot)
        ]
      );
    } catch (e) {
      if (e?.code === "ER_NO_SUCH_TABLE" || e?.errno === 1146) {
        try {
          await mysqlPool.query(`CREATE TABLE IF NOT EXISTS trash_items (
            id VARCHAR(80) NOT NULL PRIMARY KEY,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(120) NOT NULL,
            unit_id VARCHAR(20) NOT NULL DEFAULT 'MASTER',
            title VARCHAR(255) NOT NULL,
            subtitle VARCHAR(255) NULL,
            deleted_at VARCHAR(40) NOT NULL,
            deleted_by VARCHAR(150) NOT NULL,
            deleted_by_role VARCHAR(100) NULL,
            snapshot_json LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_entity_type (entity_type),
            INDEX idx_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
          await mysqlPool.query(
            `INSERT INTO trash_items (id, entity_type, entity_id, unit_id, title, subtitle, deleted_at, deleted_by, deleted_by_role, snapshot_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id,
              item.entityType,
              item.entityId,
              item.unitId,
              item.title,
              item.subtitle || null,
              item.deletedAt,
              item.deletedBy,
              item.deletedByRole || null,
              JSON.stringify(item.snapshot)
            ]
          );
        } catch (retryErr) {
          console.error("[DB Trash] Failed to create/insert trash_items:", retryErr);
        }
      } else {
        console.error("[DB Trash] Error archiving item to trash_items:", e.message);
      }
    }
  }
  if (!Array.isArray(memoryStore.trashItems)) {
    memoryStore.trashItems = [];
  }
  memoryStore.trashItems.unshift(item);
  if (memoryStore.trashItems.length > 1e3) {
    memoryStore.trashItems = memoryStore.trashItems.slice(0, 1e3);
  }
  return item;
}
function sanitizeTrashItemForClient(item) {
  const safeSnapshot = item.snapshot && typeof item.snapshot === "object" ? { ...item.snapshot } : {};
  if ("passwordHash" in safeSnapshot) {
    delete safeSnapshot.passwordHash;
  }
  if (safeSnapshot.account && typeof safeSnapshot.account === "object") {
    safeSnapshot.account = {
      ...safeSnapshot.account,
      authPassword: safeSnapshot.account.authPassword ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : ""
    };
  }
  return {
    ...item,
    snapshot: safeSnapshot
  };
}
var db = {
  isMySqlConnected: () => isMySqlConnected,
  getDbStatus: () => ({
    connected: isMySqlConnected,
    driver: "MySQL (mysql2)",
    host: process.env.MYSQL_HOST || "localhost",
    port: process.env.MYSQL_PORT || "3306",
    database: process.env.MYSQL_DATABASE || "ppdb_arrisalah",
    user: process.env.MYSQL_USER || "root",
    statusMessage: mysqlStatusMessage,
    totalRecords: {
      students: memoryStore.students.length,
      payments: memoryStore.payments.length,
      schedules: memoryStore.schedules.length,
      users: memoryStore.users.length,
      auditLogs: memoryStore.auditLogs.length
    }
  }),
  // Students
  getStudents: (filter) => {
    let list = [...memoryStore.students];
    if (filter?.unit && filter.unit !== "all" && filter.unit !== "MASTER") {
      list = list.filter((s) => s.unit === filter.unit);
    }
    if (filter?.status && filter.status !== "all") {
      list = list.filter((s) => s.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (s) => s.fullName.toLowerCase().includes(q) || s.registrationNumber.toLowerCase().includes(q) || s.parentName.toLowerCase().includes(q) || s.nisn && s.nisn.includes(q)
      );
    }
    return list;
  },
  getStudentById: (id) => {
    return memoryStore.students.find((s) => s.id === id || s.registrationNumber === id) || null;
  },
  createStudent: async (data) => {
    const unit = String(data.unit || memoryStore.units[0]?.id || "SD01").trim().toUpperCase();
    const activeAy = memoryStore.academicYears.find((a) => a.isActive) || memoryStore.academicYears[0];
    const regYear = activeAy?.year?.match(/\d{4}/)?.[0] || String((/* @__PURE__ */ new Date()).getFullYear());
    let regNum = "";
    let isRegUnique = false;
    while (!isRegUnique) {
      const randNum = Math.floor(1e3 + Math.random() * 9e3);
      regNum = `PPDB-${regYear}-${unit}-${randNum}`;
      if (!memoryStore.students.some((s) => s.registrationNumber === regNum)) {
        isRegUnique = true;
      }
    }
    let uniqueId = "";
    let isIdUnique = false;
    while (!isIdUnique) {
      const randHex = Math.random().toString(36).substring(2, 8);
      uniqueId = `reg-${Date.now()}-${randHex}`;
      if (!memoryStore.students.some((s) => s.id === uniqueId)) {
        isIdUnique = true;
      }
    }
    const now = /* @__PURE__ */ new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newStudent = {
      id: uniqueId,
      registrationNumber: regNum,
      fullName: data.fullName || "Calon Siswa Baru",
      nisn: data.nisn || "",
      unit,
      gender: data.gender || "Laki-laki",
      birthPlace: data.birthPlace || "",
      birthDate: data.birthDate || "",
      address: data.address || "",
      parentName: data.parentName || "",
      parentPhone: data.parentPhone || "",
      parentJob: data.parentJob || "",
      parentIncome: data.parentIncome || "",
      status: "verifikasi",
      registeredAt: dateStr,
      parentUserId: data.parentUserId,
      documents: data.documents && typeof data.documents === "object" ? data.documents : {},
      dynamicAnswers: data.dynamicAnswers || {},
      isOffline: Boolean(data.isOffline),
      track: data.track || void 0,
      schoolOrigin: data.schoolOrigin || void 0
    };
    const matchedParent = data.parentUserId ? memoryStore.users.find((u) => u.id === data.parentUserId) : void 0;
    let nextParentChildrenIds = [];
    if (matchedParent) {
      newStudent.parentUserId = matchedParent.id;
      nextParentChildrenIds = Array.from(/* @__PURE__ */ new Set([...matchedParent.childrenIds || [], newStudent.id]));
    } else {
      newStudent.parentUserId = void 0;
    }
    const targetUnit = memoryStore.units.find((u) => u.id === unit);
    const formFee = targetUnit ? targetUnit.formFee : 0;
    const freshBanks = await db.getBankAccountsFresh();
    const activeBanks = freshBanks.filter((b) => b.isActive);
    const defaultBank = activeBanks.find((b) => b.isPrimary) || activeBanks[0] || freshBanks[0];
    const defaultBankLabel = defaultBank ? `${defaultBank.bankName} ${defaultBank.accountNumber} a.n ${defaultBank.accountHolder}` : "";
    const newPayment = {
      id: `pay-${Date.now()}`,
      registrationId: newStudent.id,
      registrationNumber: newStudent.registrationNumber,
      studentName: newStudent.fullName,
      unit: newStudent.unit,
      type: "Formulir",
      amount: formFee,
      status: "pending",
      date: dateStr,
      proofUrl: "",
      bankAccount: defaultBankLabel
    };
    await executeMySql(
      `INSERT INTO students (id, registration_number, parent_user_id, full_name, nisn, unit, gender, birth_place, birth_date, address, parent_name, parent_phone, parent_job, parent_income, status, registered_at, documents_json, dynamic_answers_json, is_offline, track, school_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newStudent.id,
        newStudent.registrationNumber,
        newStudent.parentUserId || null,
        newStudent.fullName.slice(0, 200),
        newStudent.nisn || null,
        newStudent.unit,
        newStudent.gender,
        (newStudent.birthPlace || "").trim().slice(0, 100),
        toSqlDateOrNull(newStudent.birthDate),
        newStudent.address || "",
        (newStudent.parentName || "").trim().slice(0, 150),
        (newStudent.parentPhone || "").trim().slice(0, 30),
        (newStudent.parentJob || "").trim().slice(0, 100),
        (newStudent.parentIncome || "").trim().slice(0, 100),
        newStudent.status,
        dateStr,
        JSON.stringify(newStudent.documents || {}),
        JSON.stringify(newStudent.dynamicAnswers || {}),
        newStudent.isOffline ? 1 : 0,
        newStudent.track || null,
        newStudent.schoolOrigin || null
      ]
    );
    await executeMySql(
      `INSERT INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, bank_account)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newPayment.id,
        newPayment.registrationId,
        newPayment.registrationNumber,
        newPayment.studentName.slice(0, 150),
        newPayment.unit,
        newPayment.type,
        newPayment.amount,
        newPayment.status,
        dateStr,
        (newPayment.bankAccount || "").slice(0, 150)
      ]
    );
    if (matchedParent) {
      await executeMySql("UPDATE users SET children_ids_json = ? WHERE id = ?", [
        JSON.stringify(nextParentChildrenIds),
        matchedParent.id
      ]);
      matchedParent.childrenIds = nextParentChildrenIds;
      if (!matchedParent.studentId) {
        matchedParent.studentId = newStudent.id;
        matchedParent.studentRegistrationNumber = newStudent.registrationNumber;
      }
    }
    const nextOnlineCount = memoryStore.students.filter((s) => s.unit === unit).length + 1;
    const unitOfflineCount = Math.max(0, Number(targetUnit?.offlineCount) || 0);
    const nextFilledQuota = nextOnlineCount + unitOfflineCount;
    await executeMySql("UPDATE units SET filled_quota = ? WHERE id = ?", [nextFilledQuota, unit]);
    memoryStore.students.unshift(newStudent);
    memoryStore.payments.unshift(newPayment);
    memoryStore.units = memoryStore.units.map(
      (u) => u.id === unit ? { ...u, onlineCount: nextOnlineCount, offlineCount: unitOfflineCount, filledQuota: nextFilledQuota } : u
    );
    addAuditLog("create_pendaftar", unit, `Pendaftaran siswa baru ${newStudent.fullName} (${newStudent.registrationNumber})`);
    persistStore();
    return newStudent;
  },
  updateStudent: async (id, updates) => {
    const idx = memoryStore.students.findIndex((s2) => s2.id === id);
    if (idx === -1) return null;
    const prev = memoryStore.students[idx];
    const mergedDocuments = updates.documents ? { ...prev.documents || {}, ...updates.documents } : prev.documents;
    const mergedDynamicAnswers = updates.dynamicAnswers ? { ...prev.dynamicAnswers || {}, ...updates.dynamicAnswers } : prev.dynamicAnswers;
    const s = {
      ...prev,
      ...updates,
      id: prev.id,
      registrationNumber: prev.registrationNumber,
      documents: mergedDocuments,
      dynamicAnswers: mergedDynamicAnswers
    };
    await executeMySql(
      `UPDATE students SET
         full_name = ?,
         nisn = ?,
         unit = ?,
         gender = ?,
         birth_place = ?,
         birth_date = ?,
         address = ?,
         parent_name = ?,
         parent_phone = ?,
         parent_job = ?,
         parent_income = ?,
         status = ?,
         documents_json = ?,
         dynamic_answers_json = ?,
         verification_notes = ?,
         test_score = ?,
         test_schedule_id = ?,
         test_published = ?,
         track = ?,
         school_origin = ?
       WHERE id = ?`,
      [
        s.fullName.slice(0, 200),
        s.nisn || null,
        s.unit,
        s.gender || "Laki-laki",
        (s.birthPlace || "").trim().slice(0, 100),
        toSqlDateOrNull(s.birthDate),
        s.address || "",
        (s.parentName || "").trim().slice(0, 150),
        (s.parentPhone || "").trim().slice(0, 30),
        (s.parentJob || "").trim().slice(0, 100),
        (s.parentIncome || "").trim().slice(0, 100),
        s.status,
        JSON.stringify(s.documents || {}),
        JSON.stringify(s.dynamicAnswers || {}),
        s.verificationNotes || null,
        s.testScore ?? null,
        s.testScheduleId || null,
        s.testPublished ? 1 : 0,
        s.track || null,
        s.schoolOrigin || null,
        id
      ]
    );
    const prevUploadUrls = /* @__PURE__ */ new Set();
    collectUploadUrlsFromValue(prev.avatarUrl, prevUploadUrls);
    collectUploadUrlsFromValue(prev.documents, prevUploadUrls);
    collectUploadUrlsFromValue(prev.dynamicAnswers, prevUploadUrls);
    memoryStore.students[idx] = s;
    const nextUploadUrls = /* @__PURE__ */ new Set();
    collectUploadUrlsFromValue(s.avatarUrl, nextUploadUrls);
    collectUploadUrlsFromValue(s.documents, nextUploadUrls);
    collectUploadUrlsFromValue(s.dynamicAnswers, nextUploadUrls);
    for (const oldUrl of prevUploadUrls) {
      if (!nextUploadUrls.has(oldUrl)) {
        deleteUploadFileSafely(oldUrl);
      }
    }
    if (prev.unit !== s.unit) {
      const oldUnitObj = memoryStore.units.find((u) => u.id === prev.unit);
      const newUnitObj = memoryStore.units.find((u) => u.id === s.unit);
      const oldOnline = memoryStore.students.filter((st) => st.unit === prev.unit).length;
      const newOnline = memoryStore.students.filter((st) => st.unit === s.unit).length;
      const oldOffline = Math.max(0, Number(oldUnitObj?.offlineCount) || 0);
      const newOffline = Math.max(0, Number(newUnitObj?.offlineCount) || 0);
      const oldCount = oldOnline + oldOffline;
      const newCount = newOnline + newOffline;
      await executeMySql("UPDATE units SET filled_quota = ? WHERE id = ?", [oldCount, prev.unit]);
      await executeMySql("UPDATE units SET filled_quota = ? WHERE id = ?", [newCount, s.unit]);
      memoryStore.units = memoryStore.units.map((u) => {
        if (u.id === prev.unit) return { ...u, onlineCount: oldOnline, offlineCount: oldOffline, filledQuota: oldCount };
        if (u.id === s.unit) return { ...u, onlineCount: newOnline, offlineCount: newOffline, filledQuota: newCount };
        return u;
      });
    }
    addAuditLog("update_status", s.unit, `Pembaruan data siswa ${s.fullName}`);
    persistStore();
    return s;
  },
  deleteStudent: async (id, deletedBy = "Admin", deletedByRole = "Staff") => {
    const student = memoryStore.students.find((s) => s.id === id);
    if (!student) return false;
    const studentPayments = memoryStore.payments.filter((p) => p.registrationId === id);
    await archiveToTrash({
      entityType: "student",
      entityId: student.id,
      unitId: student.unit,
      title: student.fullName,
      subtitle: `${student.registrationNumber} \xB7 Unit ${student.unit} \xB7 Wali: ${student.parentName || "-"}`,
      deletedBy,
      deletedByRole,
      snapshot: {
        student: { ...student },
        payments: studentPayments.map((p) => ({ ...p }))
      }
    });
    await executeMySql("DELETE FROM payments WHERE registration_id = ?", [id]);
    await executeMySql("DELETE FROM students WHERE id = ?", [id]);
    const targetUnitObj = memoryStore.units.find((u) => u.id === student.unit);
    const nextOnline = Math.max(0, memoryStore.students.filter((s) => s.unit === student.unit && s.id !== id).length);
    const offlineCnt = Math.max(0, Number(targetUnitObj?.offlineCount) || 0);
    const nextFilled = nextOnline + offlineCnt;
    await executeMySql("UPDATE units SET filled_quota = ? WHERE id = ?", [nextFilled, student.unit]);
    memoryStore.students = memoryStore.students.filter((s) => s.id !== id);
    memoryStore.payments = memoryStore.payments.filter((p) => p.registrationId !== id);
    memoryStore.units = memoryStore.units.map(
      (u) => u.id === student.unit ? { ...u, onlineCount: nextOnline, offlineCount: offlineCnt, filledQuota: nextFilled } : u
    );
    addAuditLog("update_status", student.unit, `Hapus berkas siswa ${student.fullName} (${student.registrationNumber}) -> dipindahkan ke Sampah oleh ${deletedBy}`);
    persistStore();
    return true;
  },
  verifyStudent: async (id, approved, notes) => {
    const student = memoryStore.students.find((s) => s.id === id);
    if (!student) return null;
    const nextStatus = approved ? "tes" : "tidak_lulus";
    const nextNotes = notes || (approved ? "Berkas lengkap dan valid." : "Berkas ditolak.");
    await executeMySql("UPDATE students SET status = ?, verification_notes = ? WHERE id = ?", [
      nextStatus,
      nextNotes,
      id
    ]);
    student.status = nextStatus;
    student.verificationNotes = nextNotes;
    addAuditLog("verifikasi", student.unit, `Verifikasi berkas siswa ${student.fullName}: ${approved ? "Disetujui" : "Ditolak"}`);
    persistStore();
    return student;
  },
  setTestResult: async (id, score, status, publish) => {
    const student = memoryStore.students.find((s) => s.id === id);
    if (!student) return null;
    await executeMySql("UPDATE students SET test_score = ?, status = ?, test_published = ? WHERE id = ?", [
      score,
      status,
      publish ? 1 : 0,
      id
    ]);
    let newReregPayment = null;
    if (status === "lulus") {
      const exists = memoryStore.payments.some((p) => p.registrationId === id && p.type === "Daftar Ulang");
      if (!exists) {
        const u = memoryStore.units.find((item) => item.id === student.unit);
        const reRegFee = u ? u.reRegFee : 5e6;
        const now = /* @__PURE__ */ new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const reregAllBanks = await db.getBankAccountsFresh();
        const reregActiveBanks = reregAllBanks.filter((b) => b.isActive);
        const reregDefaultBank = reregActiveBanks.find((b) => b.isPrimary) || reregActiveBanks[0] || reregAllBanks[0];
        const reregBankLabel = reregDefaultBank ? `${reregDefaultBank.bankName} ${reregDefaultBank.accountNumber} a.n ${reregDefaultBank.accountHolder}` : "";
        newReregPayment = {
          id: `pay-rereg-${Date.now()}`,
          registrationId: student.id,
          registrationNumber: student.registrationNumber,
          studentName: student.fullName,
          unit: student.unit,
          type: "Daftar Ulang",
          amount: reRegFee,
          status: "pending",
          date: dateStr,
          proofUrl: "",
          bankAccount: reregBankLabel
        };
        await executeMySql(
          `INSERT INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, bank_account)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newReregPayment.id,
            newReregPayment.registrationId,
            newReregPayment.registrationNumber,
            newReregPayment.studentName,
            newReregPayment.unit,
            newReregPayment.type,
            newReregPayment.amount,
            newReregPayment.status,
            dateStr,
            newReregPayment.bankAccount
          ]
        );
      }
    }
    student.testScore = score;
    student.status = status;
    student.testPublished = publish;
    if (newReregPayment) {
      memoryStore.payments.unshift(newReregPayment);
    }
    addAuditLog("update_status", student.unit, `Penetapan hasil tes ${student.fullName}: ${status.toUpperCase()} (Skor: ${score})`);
    persistStore();
    return student;
  },
  // Payments
  getPayments: (filter) => {
    let list = [...memoryStore.payments];
    if (filter?.unit && filter.unit !== "all" && filter.unit !== "MASTER") {
      list = list.filter((p) => p.unit === filter.unit);
    }
    if (filter?.status && filter.status !== "all") {
      list = list.filter((p) => p.status === filter.status);
    }
    if (filter?.type && filter.type !== "all") {
      list = list.filter((p) => p.type === filter.type);
    }
    return list;
  },
  getPaymentsFresh: async (filter) => {
    if (mysqlPool && isMySqlConnected) {
      try {
        const [rows] = await mysqlPool.query("SELECT * FROM payments ORDER BY payment_date DESC, created_at DESC");
        if (Array.isArray(rows)) {
          memoryStore.payments = rows.map((p) => ({
            id: p.id,
            registrationId: p.registration_id,
            registrationNumber: p.registration_number,
            studentName: p.student_name,
            unit: p.unit,
            type: p.type,
            amount: Number(p.amount) || 0,
            status: p.status,
            date: formatSqlDateTime(p.payment_date),
            proofUrl: p.proof_url || "",
            verifiedBy: p.verified_by || void 0,
            verificationNotes: p.verification_notes || void 0,
            bankAccount: p.bank_account || ""
          }));
        }
      } catch (e) {
      }
    }
    return db.getPayments(filter);
  },
  uploadPaymentProof: async (registrationId, proofUrl, amount, type, bankAccountId, paymentId) => {
    const student = memoryStore.students.find((s) => s.id === registrationId);
    if (!student) return null;
    const now = /* @__PURE__ */ new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    const allBanks = await db.getBankAccountsFresh();
    const activeBanks = allBanks.filter((b) => b.isActive);
    const chosenBank = (bankAccountId ? allBanks.find((b) => b.id === bankAccountId) : void 0) || activeBanks.find((b) => b.isPrimary) || activeBanks[0] || allBanks[0];
    const resolvedBankLabel = chosenBank ? `${chosenBank.bankName} ${chosenBank.accountNumber} a.n ${chosenBank.accountHolder}` : "";
    let targetIndex = -1;
    if (paymentId && paymentId.trim()) {
      targetIndex = memoryStore.payments.findIndex(
        (p) => p.id === paymentId.trim() && p.registrationId === registrationId
      );
      if (targetIndex < 0) {
        return null;
      }
    } else {
      targetIndex = memoryStore.payments.findIndex(
        (p) => p.registrationId === registrationId && p.type === type && p.status === "pending" && (!p.proofUrl || p.proofUrl.trim() === "")
      );
    }
    let savedPayment;
    if (targetIndex >= 0) {
      const existing = memoryStore.payments[targetIndex];
      const previousProofUrl = existing.proofUrl;
      const targetBankLabel = chosenBank ? resolvedBankLabel : existing.bankAccount || resolvedBankLabel;
      await executeMySql(
        `UPDATE payments
         SET type = ?, amount = ?, proof_url = ?, status = "verifikasi", payment_date = ?, bank_account = ?, verified_by = NULL, verification_notes = NULL
         WHERE id = ?`,
        [type, amount, proofUrl, dateStr, targetBankLabel, existing.id]
      );
      existing.type = type;
      existing.amount = amount;
      existing.proofUrl = proofUrl;
      existing.status = "verifikasi";
      existing.date = dateStr;
      existing.bankAccount = targetBankLabel;
      existing.verifiedBy = void 0;
      existing.verificationNotes = void 0;
      savedPayment = existing;
      if (previousProofUrl && previousProofUrl !== proofUrl) {
        deleteUploadFileSafely(previousProofUrl);
      }
    } else {
      const uniqueSuffix = Math.floor(1e3 + Math.random() * 9e3);
      const newPay = {
        id: `pay-${Date.now()}-${uniqueSuffix}`,
        registrationId,
        registrationNumber: student.registrationNumber,
        studentName: student.fullName,
        unit: student.unit,
        type,
        amount,
        status: "verifikasi",
        date: dateStr,
        proofUrl,
        bankAccount: resolvedBankLabel
      };
      await executeMySql(
        `INSERT INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, proof_url, bank_account)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newPay.id,
          newPay.registrationId,
          newPay.registrationNumber,
          newPay.studentName,
          newPay.unit,
          newPay.type,
          newPay.amount,
          newPay.status,
          dateStr,
          proofUrl,
          newPay.bankAccount
        ]
      );
      memoryStore.payments.unshift(newPay);
      savedPayment = newPay;
    }
    addAuditLog(
      "verifikasi",
      student.unit,
      `Upload bukti transfer ${type} Rp ${Number(amount).toLocaleString("id-ID")} siswa ${student.fullName} (${savedPayment.bankAccount})`
    );
    persistStore();
    return savedPayment;
  },
  verifyPayment: async (paymentId, approved, notes, verifiedBy = "bendahara@arrisalahaceh.or.id", adjustedAmount) => {
    const pay = memoryStore.payments.find((p) => p.id === paymentId);
    if (!pay) return null;
    const nextStatus = approved ? "lunas" : "ditolak";
    const oldAmount = Number(pay.amount) || 0;
    const hasAdjustedAmount = typeof adjustedAmount === "number" && Number.isFinite(adjustedAmount) && adjustedAmount > 0 && Math.round(adjustedAmount) !== oldAmount;
    const finalAmount = typeof adjustedAmount === "number" && Number.isFinite(adjustedAmount) && adjustedAmount > 0 ? Math.round(adjustedAmount) : oldAmount;
    const nextNotes = notes && notes.trim() || (approved ? hasAdjustedAmount ? `Bukti transfer valid. Nominal disesuaikan sesuai mutasi dari Rp ${oldAmount.toLocaleString("id-ID")} menjadi Rp ${finalAmount.toLocaleString("id-ID")}.` : "Bukti transfer valid dan dana masuk." : "Bukti transfer ditolak.");
    await executeMySql(
      "UPDATE payments SET status = ?, verified_by = ?, verification_notes = ?, amount = ? WHERE id = ?",
      [nextStatus, verifiedBy, nextNotes, finalAmount, paymentId]
    );
    pay.status = nextStatus;
    pay.verifiedBy = verifiedBy;
    pay.verificationNotes = nextNotes;
    pay.amount = finalAmount;
    addAuditLog(
      "verifikasi",
      pay.unit,
      `Verifikasi pembayaran ${pay.studentName} (${pay.type}): ${approved ? "LUNAS" : "DITOLAK"}${hasAdjustedAmount ? ` [Nominal disesuaikan: Rp ${oldAmount.toLocaleString("id-ID")} -> Rp ${finalAmount.toLocaleString("id-ID")}]` : ""}`
    );
    persistStore();
    return pay;
  },
  updatePaymentAmount: async (paymentId, newAmount, updatedBy = "bendahara@arrisalahaceh.or.id") => {
    const pay = memoryStore.payments.find((p) => p.id === paymentId);
    if (!pay) return null;
    const oldAmount = Number(pay.amount) || 0;
    const finalAmount = Math.round(newAmount);
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) return null;
    await executeMySql("UPDATE payments SET amount = ? WHERE id = ?", [
      finalAmount,
      paymentId
    ]);
    pay.amount = finalAmount;
    if (oldAmount !== finalAmount) {
      addAuditLog(
        "verifikasi",
        pay.unit,
        `Penyesuaian nominal real pembayaran ${pay.studentName} (${pay.type}) oleh ${updatedBy}: Rp ${oldAmount.toLocaleString("id-ID")} -> Rp ${finalAmount.toLocaleString("id-ID")}`
      );
      persistStore();
    }
    return pay;
  },
  verifyPaymentGroup: async (paymentIds, approved, notes, verifiedBy = "bendahara@arrisalahaceh.or.id") => {
    const updatedList = [];
    const nextStatus = approved ? "lunas" : "ditolak";
    const nextNotes = notes && notes.trim() || (approved ? "Seluruh bukti transfer valid dan dana masuk." : "Bukti transfer ditolak / masih terdapat kekurangan.");
    for (const paymentId of paymentIds) {
      const pay = memoryStore.payments.find((p) => p.id === paymentId);
      if (!pay) continue;
      await executeMySql(
        "UPDATE payments SET status = ?, verified_by = ?, verification_notes = ? WHERE id = ?",
        [nextStatus, verifiedBy, nextNotes, paymentId]
      );
      pay.status = nextStatus;
      pay.verifiedBy = verifiedBy;
      pay.verificationNotes = nextNotes;
      updatedList.push(pay);
    }
    if (updatedList.length > 0) {
      const first = updatedList[0];
      addAuditLog(
        "verifikasi",
        first.unit,
        `Verifikasi ${updatedList.length} bukti pembayaran ${first.studentName} (${first.type}): ${approved ? "LUNAS" : "DITOLAK"}`
      );
      persistStore();
    }
    return updatedList;
  },
  // Schedules
  getSchedules: (unit) => {
    let list = [...memoryStore.schedules];
    if (unit && unit !== "all" && unit !== "MASTER") {
      list = list.filter((s) => s.unit === unit);
    }
    return list;
  },
  createSchedule: async (scheduleData) => {
    const newSch = {
      ...scheduleData,
      id: `sch-${Date.now()}`,
      filled: 0
    };
    await executeMySql(
      `INSERT INTO test_schedules (id, title, unit, test_date, start_time, end_time, room, examiner, quota, filled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [newSch.id, newSch.title, newSch.unit, newSch.date, newSch.startTime, newSch.endTime, newSch.room, newSch.examiner, newSch.quota]
    );
    memoryStore.schedules.push(newSch);
    addAuditLog("tambah_jadwal", scheduleData.unit, `Tambah jadwal tes: ${scheduleData.title}`);
    persistStore();
    return newSch;
  },
  updateSchedule: async (id, updates) => {
    const idx = memoryStore.schedules.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const sch = { ...memoryStore.schedules[idx], ...updates, id };
    await executeMySql(
      `UPDATE test_schedules SET
         title = ?,
         unit = ?,
         test_date = ?,
         start_time = ?,
         end_time = ?,
         room = ?,
         examiner = ?,
         quota = ?,
         filled = ?
       WHERE id = ?`,
      [
        sch.title,
        sch.unit,
        sch.date,
        sch.startTime,
        sch.endTime,
        sch.room,
        sch.examiner,
        Number(sch.quota) || 40,
        Number(sch.filled) || 0,
        id
      ]
    );
    memoryStore.schedules[idx] = sch;
    persistStore();
    return sch;
  },
  deleteSchedule: async (id, deletedBy = "Admin", deletedByRole = "Staff") => {
    const sch = memoryStore.schedules.find((s) => s.id === id);
    if (!sch) return false;
    const linkedStudentIds = memoryStore.students.filter((st) => st.testScheduleId === id).map((st) => st.id);
    await archiveToTrash({
      entityType: "schedule",
      entityId: sch.id,
      unitId: sch.unit,
      title: sch.title,
      subtitle: `Unit ${sch.unit} \xB7 ${sch.date} (${sch.startTime}-${sch.endTime}) \xB7 Ruang: ${sch.room}`,
      deletedBy,
      deletedByRole,
      snapshot: {
        schedule: { ...sch },
        linkedStudentIds
      }
    });
    if (linkedStudentIds.length > 0) {
      await executeMySql("UPDATE students SET test_schedule_id = NULL WHERE test_schedule_id = ?", [id]);
      memoryStore.students = memoryStore.students.map(
        (st) => st.testScheduleId === id ? { ...st, testScheduleId: void 0 } : st
      );
    }
    await executeMySql("DELETE FROM test_schedules WHERE id = ?", [id]);
    memoryStore.schedules = memoryStore.schedules.filter((s) => s.id !== id);
    addAuditLog("update_status", sch.unit, `Hapus jadwal tes "${sch.title}" -> dipindahkan ke Sampah oleh ${deletedBy}`);
    persistStore();
    return true;
  },
  // Units
  getUnits: () => {
    return sortUnitsList(memoryStore.units).map((u) => {
      const onlineCount = memoryStore.students.filter((s) => s.unit === u.id).length;
      const offlineCount = Math.max(0, Number(u.offlineCount) || 0);
      return {
        ...u,
        onlineCount,
        offlineCount,
        filledQuota: onlineCount + offlineCount
      };
    });
  },
  createUnit: async (data, actor = "Master Admin") => {
    const cleanId = String(data.id || "").trim().toUpperCase();
    if (!cleanId || memoryStore.units.some((u) => u.id.toUpperCase() === cleanId)) {
      return null;
    }
    const maxSort = memoryStore.units.reduce((acc, u) => Math.max(acc, Number(u.sortOrder) || 0), 0);
    const offlineCnt = Math.max(0, Math.floor(Number(data.offlineCount) || 0));
    const totalQ = Math.max(1, Math.floor(Number(data.totalQuota) || 100));
    const newUnit = {
      id: cleanId,
      name: data.name.trim(),
      shortName: data.shortName.trim(),
      totalQuota: totalQ,
      filledQuota: offlineCnt,
      onlineCount: 0,
      offlineCount: offlineCnt,
      formFee: Math.max(0, Number(data.formFee) || 0),
      reRegFee: Math.max(0, Number(data.reRegFee) || 0),
      isOpen: data.isOpen !== void 0 ? Boolean(data.isOpen) : true,
      closedNotice: data.closedNotice?.trim() || `Pendaftaran untuk unit ${data.name.trim()} saat ini sedang ditutup atau kuota telah terpenuhi.`,
      facilities: Array.isArray(data.facilities) && data.facilities.length > 0 ? data.facilities : ["Program Pendidikan Islam Terpadu"],
      sortOrder: maxSort + 1
    };
    await executeMySql(
      `INSERT INTO units (id, name, short_name, total_quota, filled_quota, offline_count, form_fee, rereg_fee, is_open, closed_notice, sort_order, facilities)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUnit.id,
        newUnit.name,
        newUnit.shortName,
        newUnit.totalQuota,
        newUnit.filledQuota,
        newUnit.offlineCount,
        newUnit.formFee,
        newUnit.reRegFee,
        newUnit.isOpen ? 1 : 0,
        newUnit.closedNotice || null,
        newUnit.sortOrder,
        JSON.stringify(newUnit.facilities || [])
      ]
    );
    memoryStore.units = sortUnitsList([...memoryStore.units, newUnit]);
    if (!memoryStore.formSchemas.some((s) => s.unitId === cleanId)) {
      const templateSections = ensureCoreNameFieldInSections(
        memoryStore.formSchemas[0]?.sections?.map((sec) => ({
          ...sec,
          id: `${sec.id}-${cleanId.toLowerCase()}`,
          fields: (sec.fields || []).map((f) => ({ ...f }))
        })) || [],
        cleanId
      );
      const newSchema = { unitId: cleanId, sections: templateSections };
      await executeMySql(
        `INSERT INTO form_schemas (unit_id, sections_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE sections_json = VALUES(sections_json)`,
        [cleanId, JSON.stringify(newSchema.sections)]
      );
      memoryStore.formSchemas.push(newSchema);
    }
    if (!memoryStore.unitContacts.some((c) => c.unitId === cleanId)) {
      const baseContact = memoryStore.unitContacts.find((c) => c.unitId === "MASTER") || memoryStore.unitContacts[0];
      const landingContact = memoryStore.landingConfig?.contact;
      memoryStore.unitContacts.push({
        unitId: cleanId,
        unitName: newUnit.name,
        contactPerson: `Panitia PPDB ${newUnit.shortName}`,
        phone: baseContact?.phone || landingContact?.phone || "",
        whatsapp: baseContact?.whatsapp || landingContact?.whatsapp || "",
        email: baseContact?.email || landingContact?.email || "",
        officeHours: baseContact?.officeHours || "Senin - Sabtu (08:00 - 15:00 WIB)",
        address: baseContact?.address || landingContact?.address || ""
      });
      await executeMySql(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('unit_contacts', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [JSON.stringify(memoryStore.unitContacts)]
      );
    }
    if (!memoryStore.letterConfigs.some((l) => l.unitId === cleanId)) {
      const baseLetter = memoryStore.letterConfigs.find((l) => l.unitId === "MASTER") || memoryStore.letterConfigs[0];
      memoryStore.letterConfigs.push({
        ...baseLetter || {},
        unitId: cleanId,
        unitName: newUnit.name,
        committeeChairName: baseLetter?.committeeChairName || "Ketua Panitia PPDB",
        committeeRoleTitle: `Ketua Panitia PPDB ${newUnit.shortName}`,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedBy: actor
      });
      await executeMySql(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('letter_configs', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [JSON.stringify(memoryStore.letterConfigs)]
      );
    }
    if (!memoryStore.groupLinkConfigs.some((g) => g.unitId === cleanId)) {
      memoryStore.groupLinkConfigs.push({
        unitId: cleanId,
        groupName: `Grup Informasi Wali Santri ${newUnit.shortName}`,
        groupUrl: "https://chat.whatsapp.com/",
        visibilityRule: "after_data"
      });
      await executeMySql(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('group_links', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [JSON.stringify(memoryStore.groupLinkConfigs)]
      );
    }
    addAuditLog("update_kuota", cleanId, `Tambah unit sekolah baru ${newUnit.name} (${cleanId}) dengan kuota ${totalQ} oleh ${actor}`, actor);
    persistStore();
    return db.getUnits().find((u) => u.id === cleanId) || newUnit;
  },
  updateUnitOfflineCount: async (unitId, offlineCount, actor = "Admin") => {
    const existing = memoryStore.units.find((u) => u.id === unitId);
    if (!existing) return null;
    const cleanOffline = Math.max(0, Math.floor(Number(offlineCount) || 0));
    const onlineCount = memoryStore.students.filter((s) => s.unit === unitId).length;
    const filledQuota = onlineCount + cleanOffline;
    await executeMySql("UPDATE units SET offline_count = ?, filled_quota = ? WHERE id = ?", [
      cleanOffline,
      filledQuota,
      unitId
    ]);
    memoryStore.units = memoryStore.units.map(
      (u) => u.id === unitId ? { ...u, offlineCount: cleanOffline, onlineCount, filledQuota } : u
    );
    addAuditLog(
      "offline_register",
      unitId,
      `Pembaruan angka pendaftar offline unit ${unitId}: ${cleanOffline} siswa (Online: ${onlineCount}, Total Terisi: ${filledQuota}/${existing.totalQuota}) oleh ${actor}`,
      actor
    );
    persistStore();
    return db.getUnits().find((u) => u.id === unitId) || null;
  },
  updateUnit: async (unitId, quota, formFee, reRegFee, isOpen, closedNotice, offlineCount) => {
    const existing = memoryStore.units.find((u) => u.id === unitId);
    if (!existing) return null;
    const nextIsOpen = isOpen !== void 0 ? isOpen : existing.isOpen !== void 0 ? existing.isOpen : true;
    const nextNotice = closedNotice !== void 0 ? closedNotice : existing.closedNotice || `Pendaftaran untuk unit ${unitId} saat ini sedang ditutup.`;
    const nextOfflineCount = offlineCount !== void 0 ? Math.max(0, Math.floor(Number(offlineCount) || 0)) : Math.max(0, Number(existing.offlineCount) || 0);
    const onlineCount = memoryStore.students.filter((s) => s.unit === unitId).length;
    const nextFilledQuota = onlineCount + nextOfflineCount;
    await executeMySql(
      "UPDATE units SET total_quota = ?, offline_count = ?, filled_quota = ?, form_fee = ?, rereg_fee = ?, is_open = ?, closed_notice = ? WHERE id = ?",
      [quota, nextOfflineCount, nextFilledQuota, formFee, reRegFee, nextIsOpen ? 1 : 0, nextNotice || null, unitId]
    );
    memoryStore.units = memoryStore.units.map(
      (u) => u.id === unitId ? {
        ...u,
        totalQuota: quota,
        offlineCount: nextOfflineCount,
        onlineCount,
        filledQuota: nextFilledQuota,
        formFee,
        reRegFee,
        isOpen: nextIsOpen,
        closedNotice: nextNotice
      } : u
    );
    addAuditLog("update_kuota", unitId, `Pembaruan kuota (${quota}), offline (${nextOfflineCount}), biaya, & status pendaftaran (${nextIsOpen ? "Buka" : "Tutup"}) untuk unit ${unitId}`);
    persistStore();
    return db.getUnits().find((u) => u.id === unitId) || null;
  },
  updateUnitRegistrationStatus: async (unitId, isOpen, closedNotice, actor = "Admin") => {
    const existing = memoryStore.units.find((u) => u.id === unitId);
    if (!existing) return null;
    const nextIsOpen = Boolean(isOpen);
    const nextNotice = closedNotice !== void 0 ? closedNotice : existing.closedNotice || `Pendaftaran untuk unit ${unitId} saat ini belum dibuka.`;
    await executeMySql("UPDATE units SET is_open = ?, closed_notice = ? WHERE id = ?", [
      nextIsOpen ? 1 : 0,
      nextNotice || null,
      unitId
    ]);
    memoryStore.units = memoryStore.units.map(
      (u) => u.id === unitId ? {
        ...u,
        isOpen: nextIsOpen,
        closedNotice: nextNotice
      } : u
    );
    addAuditLog(
      "update_kuota",
      unitId,
      `Status pendaftaran unit ${unitId} diubah menjadi ${nextIsOpen ? "AKTIF / BUKA" : "NON-AKTIF / BELUM DIBUKA"} oleh ${actor}`,
      actor
    );
    persistStore();
    return db.getUnits().find((u) => u.id === unitId) || null;
  },
  reorderUnits: async (orderedIds, actor = "Admin") => {
    const existingIds = new Set(memoryStore.units.map((u) => u.id));
    if (!Array.isArray(orderedIds) || orderedIds.length !== existingIds.size || new Set(orderedIds).size !== existingIds.size || !orderedIds.every((id) => existingIds.has(id))) {
      return null;
    }
    const orderMap = /* @__PURE__ */ new Map();
    orderedIds.forEach((id, idx) => {
      orderMap.set(id, idx + 1);
    });
    for (const [id, sortOrder] of orderMap.entries()) {
      await executeMySql("UPDATE units SET sort_order = ? WHERE id = ?", [sortOrder, id]);
    }
    memoryStore.units = sortUnitsList(
      memoryStore.units.map((u) => ({
        ...u,
        sortOrder: orderMap.get(u.id) ?? u.sortOrder ?? 99
      }))
    );
    memoryStore.formSchemas = [...memoryStore.formSchemas].sort(
      (a, b) => (orderMap.get(a.unitId) ?? 999) - (orderMap.get(b.unitId) ?? 999)
    );
    addAuditLog(
      "update_kuota",
      "MASTER",
      `Urutan unit sekolah diperbarui menjadi [${orderedIds.join(" \u2192 ")}] oleh ${actor}`,
      actor
    );
    persistStore();
    return db.getUnits();
  },
  deleteUnit: async (unitId, actor = "Master Admin") => {
    const cleanId = String(unitId || "").trim().toUpperCase();
    const target = memoryStore.units.find((u) => u.id === cleanId);
    if (!target) return { deleted: false, reason: "not_found" };
    const hasStudents = memoryStore.students.some((s) => s.unit === cleanId);
    if (hasStudents) {
      return {
        deleted: false,
        reason: "has_students"
      };
    }
    await executeMySql("DELETE FROM form_schemas WHERE unit_id = ?", [cleanId]);
    await executeMySql("DELETE FROM units WHERE id = ?", [cleanId]);
    memoryStore.units = memoryStore.units.filter((u) => u.id !== cleanId);
    memoryStore.formSchemas = memoryStore.formSchemas.filter((s) => s.unitId !== cleanId);
    memoryStore.unitContacts = memoryStore.unitContacts.filter((c) => c.unitId !== cleanId);
    memoryStore.letterConfigs = memoryStore.letterConfigs.filter((l) => l.unitId !== cleanId);
    memoryStore.groupLinkConfigs = memoryStore.groupLinkConfigs.filter((g) => g.unitId !== cleanId);
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('unit_contacts', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(memoryStore.unitContacts)]
    );
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('letter_configs', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(memoryStore.letterConfigs)]
    );
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('group_links', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(memoryStore.groupLinkConfigs)]
    );
    addAuditLog(
      "update_kuota",
      "MASTER",
      `Unit sekolah ${cleanId} (${target.shortName}) dihapus oleh ${actor}`,
      actor
    );
    persistStore();
    return { deleted: true };
  },
  // Form Schemas
  getFormSchemas: () => memoryStore.formSchemas,
  updateFormSchema: async (unitId, schema, actor = "Admin", actorRole = "Staff", skipTrashDiff = false) => {
    const cleanSchema = {
      unitId,
      sections: ensureCoreNameFieldInSections(
        Array.isArray(schema.sections) ? schema.sections : [],
        unitId
      )
    };
    if (!skipTrashDiff) {
      const previousSchema = memoryStore.formSchemas.find((s) => s.unitId === unitId);
      if (previousSchema && Array.isArray(previousSchema.sections)) {
        const nextSectionMap = new Map(cleanSchema.sections.map((sec) => [sec.id, sec]));
        for (const oldSec of previousSchema.sections) {
          const nextSec = nextSectionMap.get(oldSec.id);
          if (!nextSec) {
            await archiveToTrash({
              entityType: "form_section",
              entityId: oldSec.id,
              unitId,
              title: `Seksi Form: ${oldSec.title}`,
              subtitle: `Unit ${unitId} \xB7 ${(oldSec.fields || []).length} field pertanyaan`,
              deletedBy: actor,
              deletedByRole: actorRole,
              snapshot: { unitId, section: oldSec }
            });
          } else if (Array.isArray(oldSec.fields)) {
            const nextFieldIds = new Set((nextSec.fields || []).map((f) => f.id));
            for (const oldField of oldSec.fields) {
              if (isLockedNameField(oldField)) continue;
              if (!nextFieldIds.has(oldField.id)) {
                await archiveToTrash({
                  entityType: "form_field",
                  entityId: oldField.id,
                  unitId,
                  title: `Field Form: ${oldField.label}`,
                  subtitle: `Unit ${unitId} \xB7 Seksi: ${oldSec.title} \xB7 Tipe: ${oldField.type}`,
                  deletedBy: actor,
                  deletedByRole: actorRole,
                  snapshot: {
                    unitId,
                    sectionId: oldSec.id,
                    sectionTitle: oldSec.title,
                    field: oldField
                  }
                });
              }
            }
          }
        }
      }
    }
    await executeMySql(
      `INSERT INTO form_schemas (unit_id, sections_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE sections_json = VALUES(sections_json)`,
      [unitId, JSON.stringify(cleanSchema.sections)]
    );
    const unitOrderMap = new Map(memoryStore.units.map((u, idx) => [u.id, idx]));
    const nextList = memoryStore.formSchemas.filter((s) => s.unitId !== unitId);
    nextList.push(cleanSchema);
    nextList.sort((a, b) => (unitOrderMap.get(a.unitId) ?? 999) - (unitOrderMap.get(b.unitId) ?? 999));
    memoryStore.formSchemas = nextList;
    persistStore();
    return cleanSchema;
  },
  // Roles & Users
  getRoles: () => memoryStore.roles,
  createRole: async (roleData) => {
    const newRole = {
      ...roleData,
      id: `role-${Date.now()}`,
      userCount: 0
    };
    await executeMySql(
      `INSERT INTO roles (id, name, school_id, permissions_json, description, user_count) VALUES (?, ?, ?, ?, ?, 0)`,
      [newRole.id, newRole.name, newRole.schoolId, JSON.stringify(newRole.permissions || []), newRole.description || ""]
    );
    memoryStore.roles.push(newRole);
    persistStore();
    return newRole;
  },
  updateRole: async (id, updates) => {
    let idx = memoryStore.roles.findIndex((r) => r.id === id);
    if (idx === -1) {
      idx = memoryStore.roles.findIndex((r) => r.name.toLowerCase() === id.toLowerCase() || id === "role-admin-yys" && r.name.includes("Admin Yayasan"));
    }
    const targetRole = idx === -1 ? {
      id,
      name: updates.name || id,
      schoolId: updates.schoolId || "MASTER",
      permissions: updates.permissions || [],
      description: updates.description || "",
      userCount: 1
    } : { ...memoryStore.roles[idx], ...updates };
    await executeMySql(
      `INSERT INTO roles (id, name, school_id, permissions_json, description, user_count)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), permissions_json = VALUES(permissions_json), description = VALUES(description)`,
      [targetRole.id, targetRole.name, targetRole.schoolId, JSON.stringify(targetRole.permissions || []), targetRole.description || "", targetRole.userCount || 0]
    );
    if (targetRole.id === "role-master" || targetRole.name.includes("Super Admin")) {
      await executeMySql(
        'UPDATE users SET permissions_json = ? WHERE email = "master@dev.com" OR role = "Super Admin Yayasan"',
        [JSON.stringify(targetRole.permissions || [])]
      );
    } else if (targetRole.id === "role-admin-yys" || targetRole.name.includes("Admin Yayasan") && !targetRole.name.includes("Super")) {
      await executeMySql(
        'UPDATE users SET permissions_json = ? WHERE email = "adminyys@dev.com" OR (role LIKE "%Admin Yayasan%" AND role NOT LIKE "%Super%")',
        [JSON.stringify(targetRole.permissions || [])]
      );
    } else {
      await executeMySql("UPDATE users SET permissions_json = ? WHERE role = ? OR role = ?", [
        JSON.stringify(targetRole.permissions || []),
        targetRole.name,
        targetRole.id
      ]);
    }
    if (idx === -1) {
      memoryStore.roles.push(targetRole);
      idx = memoryStore.roles.length - 1;
    } else {
      memoryStore.roles[idx] = targetRole;
    }
    const updatedRole = memoryStore.roles[idx];
    memoryStore.users = memoryStore.users.map((u) => {
      const isSuperMatch = (u.email === "master@dev.com" || u.role === "Super Admin Yayasan") && (updatedRole.id === "role-master" || updatedRole.name.includes("Super Admin"));
      const isYysMatch = (u.email === "adminyys@dev.com" || u.role.includes("Admin Yayasan") && !u.role.includes("Super")) && (updatedRole.id === "role-admin-yys" || updatedRole.name.includes("Admin Yayasan") && !updatedRole.name.includes("Super"));
      const isStandardMatch = !isSuperMatch && !isYysMatch && (u.role === updatedRole.name || u.role === updatedRole.id);
      if ((isSuperMatch || isYysMatch || isStandardMatch) && Array.isArray(updatedRole.permissions)) {
        return { ...u, permissions: [...updatedRole.permissions] };
      }
      return u;
    });
    for (const [, session] of activeSessions.entries()) {
      const isSuperMatch = (session.user.email === "master@dev.com" || session.user.role === "Super Admin Yayasan") && (updatedRole.id === "role-master" || updatedRole.name.includes("Super Admin"));
      const isYysMatch = (session.user.email === "adminyys@dev.com" || session.user.role.includes("Admin Yayasan") && !session.user.role.includes("Super")) && (updatedRole.id === "role-admin-yys" || updatedRole.name.includes("Admin Yayasan") && !updatedRole.name.includes("Super"));
      const isStandardMatch = !isSuperMatch && !isYysMatch && (session.user.role === updatedRole.name || session.user.role === updatedRole.id);
      if ((isSuperMatch || isYysMatch || isStandardMatch) && Array.isArray(updatedRole.permissions)) {
        session.user.permissions = [...updatedRole.permissions];
      }
    }
    persistStore();
    return memoryStore.roles[idx];
  },
  deleteRole: async (id, deletedBy = "Master Admin", deletedByRole = "Super Admin Yayasan") => {
    const existing = memoryStore.roles.find((r) => r.id === id);
    if (!existing) return false;
    await archiveToTrash({
      entityType: "role",
      entityId: existing.id,
      unitId: existing.schoolId || "MASTER",
      title: existing.name,
      subtitle: `Lingkup: ${existing.schoolId} \xB7 ${(existing.permissions || []).length} hak akses`,
      deletedBy,
      deletedByRole,
      snapshot: { role: { ...existing } }
    });
    await executeMySql("DELETE FROM roles WHERE id = ?", [id]);
    memoryStore.roles = memoryStore.roles.filter((r) => r.id !== id);
    addAuditLog("update_status", "MASTER", `Hapus role "${existing.name}" -> dipindahkan ke Sampah oleh ${deletedBy}`);
    persistStore();
    return true;
  },
  getUsers: (filterForUser) => {
    let list = memoryStore.users;
    if (filterForUser) {
      const isSuper = filterForUser.role === "Super Admin Yayasan" || filterForUser.email === "master@dev.com";
      if (!isSuper) {
        list = list.filter((u) => {
          const isMasterStaff = u.role === "Super Admin Yayasan" || u.email === "master@dev.com" || u.role?.includes("Super Admin");
          const isYysStaff = u.role === "Admin Yayasan" || u.email === "adminyys@dev.com" || u.role?.includes("Admin Yayasan") && !u.role?.includes("Super");
          return !isMasterStaff && !isYysStaff;
        });
      }
    }
    return list.map(sanitizeUserForClient);
  },
  createUser: async (userData) => {
    const plainPwd = userData.password && userData.password.length >= 6 ? userData.password : crypto.randomBytes(18).toString("base64url");
    const hashedPwd = bcrypt.hashSync(plainPwd, 10);
    const { password: _omitPwd, ...cleanData } = userData;
    const newUser = {
      ...cleanData,
      id: `usr-${Date.now()}`,
      lastLogin: "-",
      passwordHash: hashedPwd
    };
    await executeMySql(
      `INSERT INTO users (id, name, email, phone, school_id, role, permissions_json, is_active, email_verified, children_ids_json, password_hash, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '-')
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         phone = VALUES(phone),
         school_id = VALUES(school_id),
         role = VALUES(role),
         permissions_json = VALUES(permissions_json),
         is_active = VALUES(is_active),
         email_verified = VALUES(email_verified)`,
      [newUser.id, newUser.name, newUser.email, newUser.phone || "", newUser.schoolId || "MASTER", newUser.role, JSON.stringify(newUser.permissions || []), newUser.isActive ? 1 : 0, newUser.emailVerified ? 1 : 0, JSON.stringify(newUser.childrenIds || []), hashedPwd]
    );
    memoryStore.users.push(newUser);
    persistStore();
    return sanitizeUserForClient(newUser);
  },
  updateUser: async (id, updates) => {
    let idx = memoryStore.users.findIndex((u2) => u2.id === id);
    if (idx === -1) {
      if (updates.email) {
        const cleanReqEmail = updates.email.trim().toLowerCase();
        idx = memoryStore.users.findIndex((u2) => u2.email.toLowerCase() === cleanReqEmail);
      }
    }
    if (idx === -1) return null;
    const prevUser = memoryStore.users[idx];
    const oldEmail = prevUser.email;
    const { password, passwordHash: _ignoredHash, sessionInvalidatedAt: _ignoredRevoked, ...cleanUpdates } = updates;
    if (cleanUpdates.email) {
      cleanUpdates.email = cleanUpdates.email.trim().toLowerCase();
    }
    const passwordChanged = Boolean(password && password.length >= 6);
    const nextHash = passwordChanged ? bcrypt.hashSync(password, 10) : prevUser.passwordHash;
    const securityChanged = passwordChanged || cleanUpdates.isActive !== void 0 && Boolean(cleanUpdates.isActive) === false || cleanUpdates.role !== void 0 && cleanUpdates.role !== prevUser.role || cleanUpdates.schoolId !== void 0 && cleanUpdates.schoolId !== prevUser.schoolId || cleanUpdates.permissions !== void 0 && JSON.stringify(cleanUpdates.permissions) !== JSON.stringify(prevUser.permissions);
    const u = {
      ...prevUser,
      ...cleanUpdates,
      passwordHash: nextHash,
      sessionInvalidatedAt: securityChanged ? Date.now() : prevUser.sessionInvalidatedAt
    };
    if (cleanUpdates.email && cleanUpdates.email !== oldEmail) {
      await executeMySql("DELETE FROM users WHERE LOWER(email) = ? AND id != ?", [oldEmail.toLowerCase(), u.id]);
    }
    if (passwordChanged && nextHash) {
      await executeMySql(
        "UPDATE users SET name = ?, email = ?, phone = ?, school_id = ?, role = ?, permissions_json = ?, is_active = ?, email_verified = ?, children_ids_json = ?, password_hash = ? WHERE id = ?",
        [u.name, u.email, u.phone || "", u.schoolId, u.role, JSON.stringify(u.permissions || []), u.isActive ? 1 : 0, u.emailVerified ? 1 : 0, JSON.stringify(u.childrenIds || []), nextHash, u.id]
      );
    } else {
      await executeMySql(
        "UPDATE users SET name = ?, email = ?, phone = ?, school_id = ?, role = ?, permissions_json = ?, is_active = ?, email_verified = ?, children_ids_json = ? WHERE id = ?",
        [u.name, u.email, u.phone || "", u.schoolId, u.role, JSON.stringify(u.permissions || []), u.isActive ? 1 : 0, u.emailVerified ? 1 : 0, JSON.stringify(u.childrenIds || []), u.id]
      );
    }
    const isParent = u.role === "Wali Siswa" || u.role === "Wali Santri" || u.role === "Wali Murid" || Boolean(u.studentId) || u.id.startsWith("usr-wali") || u.id.startsWith("wali-");
    const matchedStudentUpdates = [];
    if (isParent && (cleanUpdates.name || cleanUpdates.phone)) {
      memoryStore.students.forEach((s) => {
        const isMatch = s.parentUserId === u.id || Array.isArray(u.childrenIds) && u.childrenIds.includes(s.id) || u.studentId && s.id === u.studentId || u.studentRegistrationNumber && s.registrationNumber === u.studentRegistrationNumber;
        if (isMatch) {
          matchedStudentUpdates.push({
            student: s,
            nextParentName: cleanUpdates.name || s.parentName,
            nextParentPhone: cleanUpdates.phone || s.parentPhone
          });
        }
      });
      for (const item of matchedStudentUpdates) {
        await executeMySql("UPDATE students SET parent_name = ?, parent_phone = ? WHERE id = ?", [
          item.nextParentName,
          item.nextParentPhone,
          item.student.id
        ]);
      }
    }
    memoryStore.users[idx] = u;
    if (cleanUpdates.email && cleanUpdates.email !== oldEmail) {
      memoryStore.users = memoryStore.users.filter((item) => {
        if (item.id !== u.id && item.email.toLowerCase() === oldEmail.toLowerCase()) {
          return false;
        }
        return true;
      });
    }
    for (const item of matchedStudentUpdates) {
      item.student.parentName = item.nextParentName;
      item.student.parentPhone = item.nextParentPhone;
    }
    if (securityChanged) {
      invalidateUserSessions(u.id, oldEmail);
      invalidateUserSessions(u.id, u.email);
    } else {
      const safeU = sanitizeUserForClient(u);
      for (const [, session] of activeSessions.entries()) {
        if (session.user.id === id || session.user.email && session.user.email.toLowerCase() === oldEmail.toLowerCase() || session.user.email && session.user.email.toLowerCase() === u.email.toLowerCase()) {
          session.user = {
            ...session.user,
            ...safeU
          };
        }
      }
    }
    persistStore();
    const updatedIdx = memoryStore.users.findIndex((item) => item.id === u.id);
    return sanitizeUserForClient(updatedIdx !== -1 ? memoryStore.users[updatedIdx] : u);
  },
  deleteUser: async (id, deletedBy = "Admin", deletedByRole = "Staff") => {
    const existing = memoryStore.users.find((u) => u.id === id);
    if (!existing) return false;
    let passwordHash = null;
    if (mysqlPool && isMySqlConnected) {
      try {
        const [rows] = await mysqlPool.query("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [id]);
        if (Array.isArray(rows) && rows[0]?.password_hash) {
          passwordHash = String(rows[0].password_hash);
        }
      } catch (e) {
      }
    }
    await archiveToTrash({
      entityType: "user",
      entityId: existing.id,
      unitId: existing.schoolId || "MASTER",
      title: existing.name,
      subtitle: `${existing.email} \xB7 Role: ${existing.role} \xB7 Unit ${existing.schoolId}`,
      deletedBy,
      deletedByRole,
      snapshot: {
        user: { ...existing },
        passwordHash
      }
    });
    await executeMySql("DELETE FROM users WHERE id = ?", [id]);
    invalidateUserSessions(id, existing.email);
    memoryStore.users = memoryStore.users.filter((u) => u.id !== id);
    addAuditLog("update_status", existing.schoolId || "MASTER", `Hapus akun "${existing.name}" (${existing.email}) -> dipindahkan ke Sampah oleh ${deletedBy}`);
    persistStore();
    return true;
  },
  // Academic Years
  getAcademicYears: () => memoryStore.academicYears,
  createAcademicYear: async (yearData) => {
    const newAy = {
      ...yearData,
      id: `ay-${Date.now()}`,
      isActive: false
    };
    await executeMySql(
      "INSERT INTO academic_years (id, year_label, start_date, end_date, is_active) VALUES (?, ?, ?, ?, 0)",
      [newAy.id, newAy.year || newAy.yearLabel || "2026/2027", newAy.startDate, newAy.endDate]
    );
    memoryStore.academicYears.push(newAy);
    persistStore();
    return newAy;
  },
  activateAcademicYear: async (id) => {
    const exists = memoryStore.academicYears.some((y) => y.id === id);
    if (!exists) return false;
    await executeMySql("UPDATE academic_years SET is_active = 0");
    await executeMySql("UPDATE academic_years SET is_active = 1 WHERE id = ?", [id]);
    memoryStore.academicYears = memoryStore.academicYears.map((y) => ({
      ...y,
      isActive: y.id === id
    }));
    persistStore();
    return true;
  },
  // Landing Page Config
  getLandingConfig: () => {
    if (!memoryStore.landingConfig) {
      memoryStore.landingConfig = { ...INITIAL_LANDING_CONFIG };
    }
    if (!Array.isArray(memoryStore.landingConfig.heroSlides)) {
      memoryStore.landingConfig.heroSlides = INITIAL_LANDING_CONFIG.heroSlides;
    }
    if (memoryStore.landingConfig.appTagline === void 0) {
      memoryStore.landingConfig.appTagline = INITIAL_LANDING_CONFIG.appTagline || "Yayasan Ar-Risalah Aceh";
    }
    if (memoryStore.landingConfig.logoUrl === void 0) {
      memoryStore.landingConfig.logoUrl = INITIAL_LANDING_CONFIG.logoUrl;
    }
    if (memoryStore.landingConfig.faviconUrl === void 0) {
      memoryStore.landingConfig.faviconUrl = INITIAL_LANDING_CONFIG.faviconUrl;
    }
    if (memoryStore.landingConfig.metaTitle === void 0) {
      memoryStore.landingConfig.metaTitle = INITIAL_LANDING_CONFIG.metaTitle;
    }
    if (memoryStore.landingConfig.metaDescription === void 0) {
      memoryStore.landingConfig.metaDescription = INITIAL_LANDING_CONFIG.metaDescription;
    }
    if (memoryStore.landingConfig.metaKeywords === void 0) {
      memoryStore.landingConfig.metaKeywords = INITIAL_LANDING_CONFIG.metaKeywords;
    }
    if (memoryStore.landingConfig.author === void 0) {
      memoryStore.landingConfig.author = INITIAL_LANDING_CONFIG.author;
    }
    if (memoryStore.landingConfig.ogTitle === void 0) {
      memoryStore.landingConfig.ogTitle = INITIAL_LANDING_CONFIG.ogTitle;
    }
    if (memoryStore.landingConfig.ogDescription === void 0) {
      memoryStore.landingConfig.ogDescription = INITIAL_LANDING_CONFIG.ogDescription;
    }
    if (memoryStore.landingConfig.ogImage === void 0) {
      memoryStore.landingConfig.ogImage = INITIAL_LANDING_CONFIG.ogImage;
    }
    if (memoryStore.landingConfig.canonicalUrl === void 0) {
      memoryStore.landingConfig.canonicalUrl = INITIAL_LANDING_CONFIG.canonicalUrl;
    }
    if (memoryStore.landingConfig.jsonLdType === void 0) {
      memoryStore.landingConfig.jsonLdType = INITIAL_LANDING_CONFIG.jsonLdType;
    }
    if (memoryStore.landingConfig.structuredDataJson === void 0) {
      memoryStore.landingConfig.structuredDataJson = INITIAL_LANDING_CONFIG.structuredDataJson;
    }
    return memoryStore.landingConfig;
  },
  updateLandingConfig: async (config, actor = "Master Admin", actorRole = "Super Admin Yayasan", skipTrashDiff = false) => {
    const prevLanding = memoryStore.landingConfig || INITIAL_LANDING_CONFIG;
    const nextLanding = {
      ...prevLanding,
      ...config
    };
    if (!skipTrashDiff) {
      if (Array.isArray(prevLanding.heroSlides) && Array.isArray(nextLanding.heroSlides)) {
        const nextSlideIds = new Set(nextLanding.heroSlides.map((s) => s.id));
        for (const slide of prevLanding.heroSlides) {
          if (slide && !nextSlideIds.has(slide.id)) {
            await archiveToTrash({
              entityType: "landing_slide",
              entityId: slide.id,
              unitId: "MASTER",
              title: `Slide Hero: ${slide.title || "Banner"}`,
              subtitle: slide.subtitle || "Banner Slider Landing Page",
              deletedBy: actor,
              deletedByRole: actorRole,
              snapshot: { slide }
            });
          }
        }
      }
      if (Array.isArray(prevLanding.flowSteps) && Array.isArray(nextLanding.flowSteps)) {
        const nextStepTitles = new Set(nextLanding.flowSteps.map((st) => `${st.step}::${st.title}`));
        for (const step of prevLanding.flowSteps) {
          if (step && !nextStepTitles.has(`${step.step}::${step.title}`)) {
            await archiveToTrash({
              entityType: "landing_step",
              entityId: `step-${step.step}-${step.title.slice(0, 30)}`,
              unitId: "MASTER",
              title: `Alur Pendaftaran #${step.step}: ${step.title}`,
              subtitle: step.description,
              deletedBy: actor,
              deletedByRole: actorRole,
              snapshot: { step }
            });
          }
        }
      }
      if (Array.isArray(prevLanding.requirements) && Array.isArray(nextLanding.requirements)) {
        const nextReqs = new Set(nextLanding.requirements.map((r) => String(r).trim()));
        for (let idx = 0; idx < prevLanding.requirements.length; idx++) {
          const reqItem = String(prevLanding.requirements[idx] || "").trim();
          if (reqItem && !nextReqs.has(reqItem)) {
            await archiveToTrash({
              entityType: "landing_requirement",
              entityId: `req-${idx}-${Date.now()}`,
              unitId: "MASTER",
              title: `Syarat PPDB: ${reqItem.slice(0, 120)}`,
              subtitle: "Persyaratan Pendaftaran Landing Page",
              deletedBy: actor,
              deletedByRole: actorRole,
              snapshot: { requirement: reqItem }
            });
          }
        }
      }
    }
    await executeMySql(
      `INSERT INTO landing_config (id, app_name, app_tagline, hero_title, hero_subtitle, stats_total, flow_steps_json, requirements_json, contact_json, hero_slides_json, logo_url, favicon_url, help_title, help_subtitle, full_config_json)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         app_name = VALUES(app_name),
         app_tagline = VALUES(app_tagline),
         hero_title = VALUES(hero_title),
         hero_subtitle = VALUES(hero_subtitle),
         stats_total = VALUES(stats_total),
         flow_steps_json = VALUES(flow_steps_json),
         requirements_json = VALUES(requirements_json),
         contact_json = VALUES(contact_json),
         hero_slides_json = VALUES(hero_slides_json),
         logo_url = VALUES(logo_url),
         favicon_url = VALUES(favicon_url),
         help_title = VALUES(help_title),
         help_subtitle = VALUES(help_subtitle),
         full_config_json = VALUES(full_config_json)`,
      [
        nextLanding.appName,
        nextLanding.appTagline || "Yayasan Ar-Risalah Aceh",
        nextLanding.heroTitle,
        nextLanding.heroSubtitle,
        nextLanding.statsTotal,
        JSON.stringify(nextLanding.flowSteps || []),
        JSON.stringify(nextLanding.requirements || []),
        JSON.stringify(nextLanding.contact || {}),
        JSON.stringify(nextLanding.heroSlides || []),
        nextLanding.logoUrl || null,
        nextLanding.faviconUrl || null,
        nextLanding.helpTitle || null,
        nextLanding.helpSubtitle || null,
        JSON.stringify(nextLanding)
      ]
    );
    const prevLandingUploadUrls = /* @__PURE__ */ new Set();
    collectUploadUrlsFromValue(
      {
        logoUrl: prevLanding.logoUrl,
        faviconUrl: prevLanding.faviconUrl,
        ogImage: prevLanding.ogImage,
        heroSlides: prevLanding.heroSlides
      },
      prevLandingUploadUrls
    );
    memoryStore.landingConfig = nextLanding;
    const nextLandingUploadUrls = /* @__PURE__ */ new Set();
    collectUploadUrlsFromValue(
      {
        logoUrl: nextLanding.logoUrl,
        faviconUrl: nextLanding.faviconUrl,
        ogImage: nextLanding.ogImage,
        heroSlides: nextLanding.heroSlides
      },
      nextLandingUploadUrls
    );
    for (const oldUrl of prevLandingUploadUrls) {
      if (!nextLandingUploadUrls.has(oldUrl)) {
        deleteUploadFileSafely(oldUrl);
      }
    }
    addAuditLog("update_status", "MASTER", "Pembaruan pengaturan landing page yayasan");
    persistStore();
    return memoryStore.landingConfig;
  },
  // Audit Logs & Tamper-Evident Integrity Check
  getAuditLogs: () => memoryStore.auditLogs,
  verifyAuditLogIntegrity: () => {
    const logsNewestFirst = memoryStore.auditLogs || [];
    const totalLogs = logsNewestFirst.length;
    const chronological = [...logsNewestFirst].reverse();
    const chainedLogs = chronological.filter((l) => Boolean(l.entryHash));
    const legacyCount = totalLogs - chainedLogs.length;
    const brokenIds = [];
    for (let i = 0; i < chainedLogs.length; i++) {
      const current = chainedLogs[i];
      const expectedPrev = i === 0 ? current.prevHash || "GENESIS" : chainedLogs[i - 1].entryHash;
      if (i > 0 && current.prevHash !== expectedPrev) {
        brokenIds.push(current.id);
        continue;
      }
      const recomputed = computeAuditEntryHash(current.prevHash || "GENESIS", current);
      if (recomputed !== current.entryHash) {
        brokenIds.push(current.id);
      }
    }
    return {
      valid: brokenIds.length === 0,
      totalLogs,
      chainedCount: chainedLogs.length,
      legacyCount,
      brokenCount: brokenIds.length,
      brokenIds: brokenIds.slice(0, 20),
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  },
  // Export Configurations (Master managed)
  getExportConfigs: () => memoryStore.exportConfigs,
  saveExportConfig: async (config, updatedBy = "Master Admin") => {
    const nextList = [...memoryStore.exportConfigs];
    const existingIdx = nextList.findIndex(
      (c) => c.moduleName === config.moduleName && c.roleId === config.roleId
    );
    const now = /* @__PURE__ */ new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const payload = {
      ...config,
      id: `${config.moduleName}_${config.roleId}`,
      updatedAt: dateStr,
      updatedBy
    };
    if (existingIdx >= 0) {
      nextList[existingIdx] = payload;
    } else {
      nextList.push(payload);
    }
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('export_configs', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(nextList)]
    );
    memoryStore.exportConfigs = nextList;
    persistStore();
    addAuditLog("export_config", "MASTER", `Update aturan ekspor ${config.moduleName} untuk role ${config.roleId} (${config.allowedHeaders.length} kolom)`);
    return payload;
  },
  // SMTP Google Configuration (Master managed with Multi-Account Rotation & Failover)
  getSmtpConfig: () => memoryStore.smtpConfig,
  getDecryptedSmtpPassword: () => {
    const raw = memoryStore.smtpConfig?.authPassword || "";
    if (!raw) return "";
    return decryptSecret(raw);
  },
  // Returns all active SMTP accounts with decrypted passwords for rotation & failover
  getDecryptedSmtpAccounts: () => {
    const config = memoryStore.smtpConfig;
    const result = [];
    if (Array.isArray(config.accounts) && config.accounts.length > 0) {
      config.accounts.forEach((acc, idx) => {
        if (acc && acc.senderEmail && acc.isActive !== false) {
          result.push({
            id: acc.id || `smtp-acc-${idx + 1}`,
            senderEmail: acc.senderEmail.trim(),
            senderName: acc.senderName || config.senderName || "Panitia PPDB Yayasan Ar-Risalah Aceh",
            authPassword: acc.authPassword ? decryptSecret(acc.authPassword) : "",
            host: acc.host || config.host || "smtp.gmail.com",
            port: Number(acc.port) || config.port || 465,
            secure: acc.secure !== void 0 ? acc.secure : config.secure !== void 0 ? config.secure : true,
            isActive: true,
            priority: Number(acc.priority) || idx + 1,
            isVerified: acc.isVerified,
            lastTested: acc.lastTested
          });
        }
      });
    }
    if (config.senderEmail) {
      const exists = result.some((r) => r.senderEmail.toLowerCase() === config.senderEmail.toLowerCase());
      if (!exists) {
        const rawPass = config.authPassword ? decryptSecret(config.authPassword) : "";
        result.unshift({
          id: "smtp-primary",
          senderEmail: config.senderEmail.trim(),
          senderName: config.senderName || "Panitia PPDB Yayasan Ar-Risalah Aceh",
          authPassword: rawPass,
          host: config.host || "smtp.gmail.com",
          port: Number(config.port) || 465,
          secure: config.secure !== void 0 ? config.secure : true,
          isActive: config.enabled !== false,
          priority: 0,
          isVerified: config.isVerified,
          lastTested: config.lastTested
        });
      }
    }
    result.sort((a, b) => a.priority - b.priority);
    return result;
  },
  saveSmtpConfig: async (config, actor = "Master Admin", actorRole = "Super Admin Yayasan", skipTrashDiff = false) => {
    const current = memoryStore.smtpConfig;
    let passwordToStore = current?.authPassword || "";
    if (config.authPassword !== void 0) {
      const cleanPass = config.authPassword.trim();
      if (cleanPass && cleanPass !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") {
        passwordToStore = encryptSecret(cleanPass);
      } else if (!cleanPass) {
        passwordToStore = "";
      }
    }
    let processedAccounts = [];
    if (Array.isArray(config.accounts)) {
      const currentAccountsMap = /* @__PURE__ */ new Map();
      if (Array.isArray(current?.accounts)) {
        current.accounts.forEach((acc) => {
          if (acc && acc.id) currentAccountsMap.set(acc.id, acc);
          if (acc && acc.senderEmail) currentAccountsMap.set(acc.senderEmail.toLowerCase(), acc);
        });
      }
      processedAccounts = config.accounts.map((acc, idx) => {
        const accId = acc.id || `acc-${Date.now()}-${idx}`;
        const existing = currentAccountsMap.get(accId) || currentAccountsMap.get((acc.senderEmail || "").toLowerCase());
        let accPass = existing?.authPassword || "";
        if (acc.authPassword !== void 0) {
          const cleanAccPass = acc.authPassword.trim();
          if (cleanAccPass && cleanAccPass !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") {
            accPass = encryptSecret(cleanAccPass);
          } else if (!cleanAccPass) {
            accPass = "";
          }
        }
        return {
          id: accId,
          senderEmail: acc.senderEmail ? acc.senderEmail.trim() : "",
          senderName: acc.senderName ? acc.senderName.trim() : config.senderName || "Panitia PPDB Yayasan Ar-Risalah Aceh",
          authPassword: accPass,
          host: acc.host || config.host || "smtp.gmail.com",
          port: Number(acc.port) || config.port || 465,
          secure: acc.secure !== void 0 ? acc.secure : config.secure !== void 0 ? config.secure : true,
          isActive: acc.isActive !== false,
          priority: Number(acc.priority) || idx + 1,
          isVerified: acc.isVerified !== void 0 ? acc.isVerified : existing?.isVerified,
          lastTested: acc.lastTested || existing?.lastTested
        };
      });
      if (!skipTrashDiff && Array.isArray(current?.accounts)) {
        const nextAccIds = new Set(processedAccounts.map((a) => a.id));
        const nextAccEmails = new Set(processedAccounts.map((a) => (a.senderEmail || "").toLowerCase()));
        for (const oldAcc of current.accounts) {
          const stillExists = oldAcc.id && nextAccIds.has(oldAcc.id) || oldAcc.senderEmail && nextAccEmails.has(oldAcc.senderEmail.toLowerCase());
          if (!stillExists) {
            await archiveToTrash({
              entityType: "smtp_account",
              entityId: oldAcc.id || oldAcc.senderEmail,
              unitId: "MASTER",
              title: `Akun SMTP: ${oldAcc.senderEmail}`,
              subtitle: oldAcc.senderName || "Akun Rotasi Gmail PPDB",
              deletedBy: actor,
              deletedByRole: actorRole,
              snapshot: { account: oldAcc }
            });
          }
        }
      }
    } else if (Array.isArray(current?.accounts)) {
      processedAccounts = current.accounts;
    }
    const payload = {
      ...config,
      authPassword: passwordToStore,
      accounts: processedAccounts,
      lastTested: (/* @__PURE__ */ new Date()).toLocaleString("id-ID")
    };
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('smtp_config', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(payload)]
    );
    memoryStore.smtpConfig = payload;
    persistStore();
    addAuditLog("smtp_config", "MASTER", `Pembaruan konfigurasi SMTP Google terenkripsi AES-256 (${config.senderEmail}, ${processedAccounts.length} akun rotasi)`);
    return memoryStore.smtpConfig;
  },
  // Group Link Configurations
  getGroupLinkConfigs: () => memoryStore.groupLinkConfigs,
  // Cloudflare Turnstile Security Configuration (Master managed)
  getCloudflareConfig: () => memoryStore.cloudflareConfig || INITIAL_CLOUDFLARE_CONFIG,
  getDecryptedCloudflareSecret: () => {
    return (process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "").trim();
  },
  saveCloudflareConfig: async (config, updatedBy = "Master Admin") => {
    const current = memoryStore.cloudflareConfig || INITIAL_CLOUDFLARE_CONFIG;
    const payload = {
      ...current,
      ...config,
      enabled: false,
      secretKey: "",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy
    };
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('cloudflare_config', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(payload)]
    );
    memoryStore.cloudflareConfig = payload;
    persistStore();
    return memoryStore.cloudflareConfig;
  },
  saveGroupLinkConfig: async (config) => {
    const nextList = [...memoryStore.groupLinkConfigs || []];
    const idx = nextList.findIndex((g) => g.unitId === config.unitId);
    if (idx >= 0) {
      nextList[idx] = config;
    } else {
      nextList.push(config);
    }
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('group_links', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(nextList)]
    );
    memoryStore.groupLinkConfigs = nextList;
    persistStore();
    addAuditLog("update_status", config.unitId === "ALL" ? "MASTER" : config.unitId, `Pembaruan link grup ${config.groupName} (${config.visibilityRule})`);
    return memoryStore.groupLinkConfigs;
  },
  getUnitContacts: () => memoryStore.unitContacts || INITIAL_UNIT_CONTACTS,
  saveUnitContact: async (config, updatedBy = "Admin") => {
    const list = [...memoryStore.unitContacts || INITIAL_UNIT_CONTACTS];
    const idx = list.findIndex((c) => c.unitId === config.unitId);
    const payload = {
      ...config,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy
    };
    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.push(payload);
    }
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('unit_contacts', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(list)]
    );
    memoryStore.unitContacts = list;
    persistStore();
    addAuditLog("update_status", config.unitId === "MASTER" ? "MASTER" : config.unitId, `Pembaruan kontak unit ${config.unitName} (${config.contactPerson})`);
    return memoryStore.unitContacts;
  },
  getLetterConfigs: () => memoryStore.letterConfigs || INITIAL_LETTER_CONFIGS,
  saveLetterConfig: async (config, updatedBy = "Admin") => {
    const list = [...memoryStore.letterConfigs || INITIAL_LETTER_CONFIGS];
    const idx = list.findIndex((c) => c.unitId === config.unitId);
    const payload = {
      ...config,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy
    };
    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.push(payload);
    }
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('letter_configs', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(list)]
    );
    memoryStore.letterConfigs = list;
    persistStore();
    addAuditLog(
      "update_status",
      config.unitId === "MASTER" ? "MASTER" : config.unitId,
      `Pembaruan format surat & ketua panitia unit ${config.unitName} (${config.committeeChairName})`
    );
    return memoryStore.letterConfigs;
  },
  // Yayasan Multi-Bank Accounts Management
  getBankAccounts: () => {
    const list = Array.isArray(memoryStore.bankAccounts) ? [...memoryStore.bankAccounts] : [];
    return list.sort((a, b) => {
      if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) return a.isPrimary ? -1 : 1;
      if (Boolean(a.isActive) !== Boolean(b.isActive)) return a.isActive ? -1 : 1;
      return (a.sortOrder ?? 99) - (b.sortOrder ?? 99);
    });
  },
  getBankAccountsFresh: async () => {
    if (mysqlPool && isMySqlConnected) {
      try {
        const [rows] = await mysqlPool.query(
          "SELECT setting_value FROM system_settings WHERE setting_key = 'bank_accounts' LIMIT 1"
        );
        if (Array.isArray(rows) && rows.length > 0 && rows[0]?.setting_value) {
          const parsed = safeJsonParse(rows[0].setting_value, []);
          if (Array.isArray(parsed)) {
            memoryStore.bankAccounts = parsed;
          }
        }
      } catch (e) {
      }
    }
    return db.getBankAccounts();
  },
  saveBankAccount: async (account, updatedBy = "Admin Yayasan") => {
    let list = [...Array.isArray(memoryStore.bankAccounts) ? memoryStore.bankAccounts : []];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const isNew = !account.id || !list.some((b) => b.id === account.id);
    const id = account.id && account.id.trim() ? account.id.trim() : `bank-${Date.now()}`;
    const shouldBePrimary = Boolean(account.isPrimary) || list.length === 0 && account.isActive;
    const nextIsActive = shouldBePrimary ? true : Boolean(account.isActive);
    const payload = {
      ...account,
      id,
      isActive: nextIsActive,
      isPrimary: shouldBePrimary,
      sortOrder: account.sortOrder ?? list.length + 1,
      updatedAt: nowIso,
      updatedBy
    };
    if (shouldBePrimary) {
      list = list.map((b) => ({ ...b, isPrimary: false }));
    }
    if (isNew) {
      list.push(payload);
    } else {
      list = list.map((b) => b.id === id ? payload : b);
    }
    if (!list.some((b) => b.isPrimary && b.isActive)) {
      const firstActive = list.find((b) => b.isActive);
      if (firstActive) {
        list = list.map((b) => ({ ...b, isPrimary: b.id === firstActive.id }));
      }
    }
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('bank_accounts', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(list)]
    );
    memoryStore.bankAccounts = list;
    const sortedAfterSave = db.getBankAccounts();
    const activeAfterSave = sortedAfterSave.filter((b) => b.isActive);
    const primaryAfterSave = activeAfterSave.find((b) => b.isPrimary) || activeAfterSave[0];
    const nextPrimaryLabel = primaryAfterSave ? `${primaryAfterSave.bankName} ${primaryAfterSave.accountNumber} a.n ${primaryAfterSave.accountHolder}` : "";
    await executeMySql(
      "UPDATE payments SET bank_account = ? WHERE status = 'pending' AND (proof_url IS NULL OR proof_url = '')",
      [nextPrimaryLabel]
    );
    memoryStore.payments = memoryStore.payments.map(
      (p) => p.status === "pending" && !p.proofUrl ? { ...p, bankAccount: nextPrimaryLabel } : p
    );
    persistStore();
    addAuditLog(
      "update_status",
      "MASTER",
      `${isNew ? "Menambahkan" : "Memperbarui"} rekening yayasan: ${payload.bankCode || payload.bankName} ${payload.accountNumber} a.n ${payload.accountHolder} (oleh ${updatedBy})`
    );
    return sortedAfterSave;
  },
  deleteBankAccount: async (id, updatedBy = "Admin Yayasan") => {
    const list = [...Array.isArray(memoryStore.bankAccounts) ? memoryStore.bankAccounts : []];
    const target = list.find((b) => b.id === id);
    if (!target) return null;
    let nextList = list.filter((b) => b.id !== id);
    if (target.isPrimary && nextList.length > 0 && !nextList.some((b) => b.isPrimary && b.isActive)) {
      const fallbackPrimary = nextList.find((b) => b.isActive) || nextList[0];
      if (fallbackPrimary) {
        nextList = nextList.map((b) => ({ ...b, isPrimary: b.id === fallbackPrimary.id }));
      }
    }
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('bank_accounts', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(nextList)]
    );
    memoryStore.bankAccounts = nextList;
    const sortedAfterDelete = db.getBankAccounts();
    const activeAfterDelete = sortedAfterDelete.filter((b) => b.isActive);
    const primaryAfterDelete = activeAfterDelete.find((b) => b.isPrimary) || activeAfterDelete[0];
    const nextPrimaryLabel = primaryAfterDelete ? `${primaryAfterDelete.bankName} ${primaryAfterDelete.accountNumber} a.n ${primaryAfterDelete.accountHolder}` : "";
    await executeMySql(
      "UPDATE payments SET bank_account = ? WHERE status = 'pending' AND (proof_url IS NULL OR proof_url = '')",
      [nextPrimaryLabel]
    );
    memoryStore.payments = memoryStore.payments.map(
      (p) => p.status === "pending" && !p.proofUrl ? { ...p, bankAccount: nextPrimaryLabel } : p
    );
    persistStore();
    addAuditLog(
      "update_status",
      "MASTER",
      `Menghapus rekening yayasan: ${target.bankCode || target.bankName} ${target.accountNumber} a.n ${target.accountHolder} (oleh ${updatedBy})`
    );
    return sortedAfterDelete;
  },
  // Wali Registration & Email Verification
  registerWaliAccount: async (data, ip = "127.0.0.1") => {
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = memoryStore.users.find(
      (u) => u.email.toLowerCase() === cleanEmail || u.phone.replace(/\D/g, "") === data.phone.replace(/\D/g, "")
    );
    if (existing) {
      return { success: false, error: "Email atau nomor WhatsApp ini sudah terdaftar. Silakan login ke akun Anda." };
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password.trim(), salt);
    const newUser = {
      id: `usr-wali-${Date.now()}`,
      name: data.name.trim(),
      email: cleanEmail,
      phone: data.phone.trim(),
      schoolId: "MASTER",
      role: "Wali Siswa",
      permissions: ["Portal Wali", "Anak Saya", "Pembayaran", "Profil"],
      isActive: true,
      lastLogin: (/* @__PURE__ */ new Date()).toISOString(),
      emailVerified: false,
      childrenIds: [],
      passwordHash: hashedPassword
    };
    await executeMySql(
      `INSERT INTO users (id, name, email, phone, school_id, role, permissions_json, is_active, email_verified, children_ids_json, password_hash, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         phone = VALUES(phone),
         is_active = VALUES(is_active),
         email_verified = VALUES(email_verified),
         password_hash = VALUES(password_hash)`,
      [
        newUser.id,
        newUser.name,
        newUser.email,
        newUser.phone || "",
        newUser.schoolId || "MASTER",
        newUser.role,
        JSON.stringify(newUser.permissions || []),
        newUser.isActive ? 1 : 0,
        newUser.emailVerified ? 1 : 0,
        JSON.stringify(newUser.childrenIds || []),
        hashedPassword,
        newUser.lastLogin || null
      ]
    );
    memoryStore.users.push(newUser);
    persistStore();
    const safeUser = sanitizeUserForClient(newUser);
    const session = db.createSessionForUser(safeUser, ip);
    addAuditLog("login", "MASTER", `Pendaftaran akun wali baru: ${safeUser.name} (${safeUser.email})`, safeUser.email, ip);
    return { success: true, user: safeUser, token: session.token };
  },
  // -------------------------------------------------------------
  // Email OTP Verification for Parent (Wali Siswa)
  // -------------------------------------------------------------
  generateEmailVerificationOtp: (identifier, ip = "127.0.0.1") => {
    const user = memoryStore.users.find(
      (u) => u.id === identifier || u.email.toLowerCase() === identifier.trim().toLowerCase()
    );
    if (!user) {
      return { success: false, error: "Pengguna wali tidak ditemukan." };
    }
    if (user.emailVerified) {
      return { success: false, error: "Alamat email ini sudah terverifikasi sebelumnya." };
    }
    const existing = emailVerificationOtps.get(user.id);
    if (existing && Date.now() - existing.lastSentAt < 6e4) {
      const remainingSeconds = Math.ceil((6e4 - (Date.now() - existing.lastSentAt)) / 1e3);
      return {
        success: false,
        error: `Silakan tunggu ${remainingSeconds} detik lagi sebelum meminta kode OTP baru.`,
        cooldownSeconds: remainingSeconds
      };
    }
    const otp = crypto.randomInt(1e5, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1e3;
    const record = {
      userId: user.id,
      email: user.email,
      otp,
      expiresAt,
      attemptsLeft: 5,
      createdAt: Date.now(),
      lastSentAt: Date.now()
    };
    emailVerificationOtps.set(user.id, record);
    addAuditLog(
      "send_otp",
      user.schoolId || "MASTER",
      `Permintaan kode OTP verifikasi email untuk ${user.email} (Kedaluwarsa 10 menit)`,
      user.email,
      ip
    );
    return {
      success: true,
      user,
      email: user.email,
      otp,
      expiresAt,
      cooldownSeconds: 60
    };
  },
  verifyEmailVerificationOtp: async (identifier, inputOtp, ip = "127.0.0.1") => {
    const user = memoryStore.users.find(
      (u) => u.id === identifier || u.email.toLowerCase() === identifier.trim().toLowerCase()
    );
    if (!user) {
      return { success: false, error: "Pengguna wali tidak ditemukan." };
    }
    const cleanOtp = (inputOtp || "").trim().replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleanOtp)) {
      return { success: false, error: "Kode OTP harus berupa 6 digit angka numerik." };
    }
    const record = emailVerificationOtps.get(user.id);
    if (!record || Date.now() > record.expiresAt) {
      if (record) emailVerificationOtps.delete(user.id);
      return {
        success: false,
        error: "Kode OTP telah kedaluwarsa atau belum pernah diminta. Silakan klik tombol Kirim Ulang OTP."
      };
    }
    if (record.attemptsLeft <= 0) {
      emailVerificationOtps.delete(user.id);
      return {
        success: false,
        error: "Percobaan telah melebihi batas (5x salah). Kode OTP telah hangus, silakan minta kode OTP baru demi keamanan."
      };
    }
    if (cleanOtp !== record.otp) {
      record.attemptsLeft -= 1;
      addAuditLog(
        "unauthorized_access",
        user.schoolId || "MASTER",
        `Kode OTP salah untuk ${user.email}. Sisa kesempatan: ${record.attemptsLeft}`,
        user.email,
        ip
      );
      if (record.attemptsLeft <= 0) {
        emailVerificationOtps.delete(user.id);
        return {
          success: false,
          error: "Kode OTP salah dan batas percobaan habis. Silakan minta kode OTP baru."
        };
      }
      return {
        success: false,
        error: `Kode OTP yang Anda masukkan salah. Sisa kesempatan mencoba: ${record.attemptsLeft} kali.`,
        attemptsLeft: record.attemptsLeft
      };
    }
    await executeMySql("UPDATE users SET is_active = 1, email_verified = 1 WHERE id = ?", [user.id]);
    emailVerificationOtps.delete(user.id);
    user.emailVerified = true;
    persistStore();
    addAuditLog(
      "verify_email",
      user.schoolId || "MASTER",
      `Verifikasi email via OTP BERHASIL: ${user.email}`,
      user.email,
      ip
    );
    return {
      success: true,
      user: sanitizeUserForClient(user),
      message: "Alhamdulillah, alamat email Anda berhasil diverifikasi secara resmi!"
    };
  },
  verifyWaliEmail: async (identifier) => {
    const user = memoryStore.users.find(
      (u) => u.id === identifier || u.email.toLowerCase() === identifier.trim().toLowerCase()
    );
    if (!user) {
      return { success: false, error: "Pengguna wali tidak ditemukan." };
    }
    await executeMySql("UPDATE users SET email_verified = 1, is_active = 1 WHERE id = ?", [user.id]);
    user.emailVerified = true;
    persistStore();
    addAuditLog("verify_email", user.schoolId || "MASTER", `Email terverifikasi: ${user.email}`, user.email, "127.0.0.1");
    return { success: true, user: sanitizeUserForClient(user) };
  },
  // Offline / Manual Registration (Direct Quota Deduction & MySQL Persistence)
  addOfflineStudent: async (data, recordedBy, ip = "127.0.0.1") => {
    const unit = String(data.unit || memoryStore.units[0]?.id || "SD01").trim().toUpperCase();
    const activeAy = memoryStore.academicYears.find((a) => a.isActive) || memoryStore.academicYears[0];
    const regYear = activeAy?.year?.match(/\d{4}/)?.[0] || String((/* @__PURE__ */ new Date()).getFullYear());
    let regNum = "";
    while (!regNum || memoryStore.students.some((s) => s.registrationNumber === regNum)) {
      const randNum = Math.floor(100 + Math.random() * 900);
      regNum = `PPDB-${regYear}-${unit}-OFF${randNum}`;
    }
    let uniqueId = "";
    while (!uniqueId || memoryStore.students.some((s) => s.id === uniqueId)) {
      const randHex = Math.random().toString(36).substring(2, 8);
      uniqueId = `reg-off-${Date.now()}-${randHex}`;
    }
    const now = /* @__PURE__ */ new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newStudent = {
      id: uniqueId,
      registrationNumber: regNum,
      fullName: data.fullName || "Calon Siswa Walk-in (Offline)",
      nisn: data.nisn || "",
      unit,
      gender: data.gender || "Laki-laki",
      birthPlace: data.birthPlace || "",
      birthDate: data.birthDate || "",
      address: data.address || "",
      parentName: data.parentName || "",
      parentPhone: data.parentPhone || "",
      parentJob: data.parentJob || "",
      parentIncome: data.parentIncome || "",
      status: "terdaftar",
      registeredAt: dateStr,
      documents: data.documents && typeof data.documents === "object" ? data.documents : {},
      dynamicAnswers: data.dynamicAnswers || {},
      isOffline: true,
      track: data.track || "Reguler",
      schoolOrigin: data.schoolOrigin || void 0,
      verificationNotes: `Pendaftar offline walk-in dicatat oleh ${recordedBy}.`
    };
    const targetUnit = memoryStore.units.find((u) => u.id === unit);
    const formFee = targetUnit ? targetUnit.formFee : 3e5;
    const newPayment = {
      id: `pay-off-${Date.now()}`,
      registrationId: newStudent.id,
      registrationNumber: newStudent.registrationNumber,
      studentName: newStudent.fullName,
      unit: newStudent.unit,
      type: "Formulir",
      amount: formFee,
      status: "lunas",
      date: dateStr,
      proofUrl: "",
      bankAccount: "Loket PPDB Offline Kampus Ar-Risalah (Tunai)",
      verifiedBy: recordedBy,
      verificationNotes: "Pembayaran formulir tunai langsung di loket PPDB"
    };
    await executeMySql(
      `INSERT INTO students (id, registration_number, parent_user_id, full_name, nisn, unit, gender, birth_place, birth_date, address, parent_name, parent_phone, parent_job, parent_income, status, registered_at, documents_json, dynamic_answers_json, verification_notes, is_offline, track, school_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        newStudent.id,
        newStudent.registrationNumber,
        null,
        newStudent.fullName.slice(0, 200),
        newStudent.nisn || null,
        newStudent.unit,
        newStudent.gender,
        (newStudent.birthPlace || "").trim().slice(0, 100),
        toSqlDateOrNull(newStudent.birthDate),
        newStudent.address || "",
        (newStudent.parentName || "").trim().slice(0, 150),
        (newStudent.parentPhone || "").trim().slice(0, 30),
        (newStudent.parentJob || "").trim().slice(0, 100),
        (newStudent.parentIncome || "").trim().slice(0, 100),
        newStudent.status,
        dateStr,
        JSON.stringify(newStudent.documents || {}),
        JSON.stringify(newStudent.dynamicAnswers || {}),
        newStudent.verificationNotes || null,
        newStudent.track || "Reguler",
        newStudent.schoolOrigin || null
      ]
    );
    await executeMySql(
      `INSERT INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, verified_by, verification_notes, bank_account)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newPayment.id,
        newPayment.registrationId,
        newPayment.registrationNumber,
        newPayment.studentName,
        newPayment.unit,
        newPayment.type,
        newPayment.amount,
        newPayment.status,
        dateStr,
        newPayment.verifiedBy || null,
        newPayment.verificationNotes || null,
        newPayment.bankAccount
      ]
    );
    const nextOnlineCount = memoryStore.students.filter((s) => s.unit === unit).length + 1;
    const offlineCnt = Math.max(0, Number(targetUnit?.offlineCount) || 0);
    const nextFilledQuota = nextOnlineCount + offlineCnt;
    await executeMySql("UPDATE units SET filled_quota = ? WHERE id = ?", [nextFilledQuota, unit]);
    memoryStore.students.unshift(newStudent);
    memoryStore.payments.unshift(newPayment);
    memoryStore.units = memoryStore.units.map(
      (u) => u.id === unit ? { ...u, onlineCount: nextOnlineCount, offlineCount: offlineCnt, filledQuota: nextFilledQuota } : u
    );
    addAuditLog("offline_register", unit, `Input pendaftar offline ${newStudent.fullName} (${newStudent.registrationNumber}) oleh ${recordedBy}`, recordedBy, ip);
    persistStore();
    return newStudent;
  },
  // Full MySQL Dump generator
  getSqlDump: () => {
    const schemaPath = path.resolve(process.cwd(), "server", "schema.sql");
    if (fs.existsSync(schemaPath)) {
      return fs.readFileSync(schemaPath, "utf-8");
    }
    return "-- MySQL schema file";
  },
  // Secure Unified Authentication & Session Management with Bcrypt Password Verification
  authenticateUser: async (identifier, passwordPlain, ipAddress = "127.0.0.1") => {
    const cleanIdent = identifier.trim().toLowerCase();
    const cleanPhone = identifier.replace(/[^0-9]/g, "");
    let matchedUser = void 0;
    let passwordHashInDb = null;
    if (mysqlPool && isMySqlConnected) {
      try {
        const hasValidPhone = cleanPhone.length >= 8;
        const userSql = hasValidPhone ? "SELECT id, name, email, phone, school_id AS schoolId, role, permissions_json AS permissionsJson, is_active AS isActive, email_verified AS emailVerified, children_ids_json AS childrenIdsJson, password_hash AS passwordHash FROM users WHERE LOWER(email) = ? OR LOWER(id) = ? OR phone = ? LIMIT 1" : "SELECT id, name, email, phone, school_id AS schoolId, role, permissions_json AS permissionsJson, is_active AS isActive, email_verified AS emailVerified, children_ids_json AS childrenIdsJson, password_hash AS passwordHash FROM users WHERE LOWER(email) = ? OR LOWER(id) = ? LIMIT 1";
        const userParams = hasValidPhone ? [cleanIdent, cleanIdent, cleanPhone] : [cleanIdent, cleanIdent];
        const [rows] = await mysqlPool.query(userSql, userParams);
        if (Array.isArray(rows) && rows.length > 0) {
          const r = rows[0];
          passwordHashInDb = r.passwordHash || null;
          matchedUser = {
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone || "",
            schoolId: r.schoolId || "MASTER",
            role: r.role,
            permissions: typeof r.permissionsJson === "string" ? JSON.parse(r.permissionsJson) : r.permissionsJson || [],
            isActive: Boolean(r.isActive),
            emailVerified: Boolean(r.emailVerified),
            childrenIds: typeof r.childrenIdsJson === "string" ? JSON.parse(r.childrenIdsJson) : r.childrenIdsJson || [],
            lastLogin: (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").substring(0, 19)
          };
          const memIdx = memoryStore.users.findIndex((u) => u.id === matchedUser.id);
          const syncedUser = {
            ...matchedUser,
            passwordHash: passwordHashInDb || void 0
          };
          if (memIdx >= 0) {
            memoryStore.users[memIdx] = { ...memoryStore.users[memIdx], ...syncedUser };
          } else {
            memoryStore.users.push(syncedUser);
          }
        }
      } catch (sqlErr) {
        console.error("[DB Auth] MySQL query error, fallback to memory store:", sqlErr);
      }
    }
    if (!matchedUser) {
      const memUser = memoryStore.users.find(
        (u) => u.email.toLowerCase() === cleanIdent || cleanPhone.length >= 8 && u.phone && u.phone.replace(/[^0-9]/g, "") === cleanPhone || u.id && u.id.toLowerCase() === cleanIdent
      );
      if (memUser) {
        matchedUser = memUser;
        if (!passwordHashInDb && memUser.passwordHash) {
          passwordHashInDb = memUser.passwordHash;
        }
      }
    }
    let isVirtualStudentUser = false;
    if (!matchedUser) {
      let matchedStudent = void 0;
      if (mysqlPool && isMySqlConnected) {
        try {
          const hasValidPhone = cleanPhone.length >= 8;
          const studentSql = hasValidPhone ? "SELECT * FROM students WHERE LOWER(registration_number) = ? OR LOWER(id) = ? OR nisn = ? OR parent_phone = ? LIMIT 1" : "SELECT * FROM students WHERE LOWER(registration_number) = ? OR LOWER(id) = ? OR nisn = ? LIMIT 1";
          const studentParams = hasValidPhone ? [cleanIdent, cleanIdent, cleanIdent, cleanPhone] : [cleanIdent, cleanIdent, cleanIdent];
          const [rows] = await mysqlPool.query(studentSql, studentParams);
          if (Array.isArray(rows) && rows.length > 0) {
            const s = rows[0];
            const parsedDocs = safeJsonParse(s.documents_json, {});
            matchedStudent = {
              id: s.id,
              registrationNumber: s.registration_number,
              parentUserId: s.parent_user_id || void 0,
              fullName: s.full_name,
              nisn: s.nisn,
              unit: s.unit,
              gender: s.gender,
              birthPlace: s.birth_place || "",
              birthDate: formatSqlDate(s.birth_date, ""),
              address: s.address || "",
              parentName: s.parent_name || "",
              parentPhone: s.parent_phone || "",
              parentJob: s.parent_job || "",
              parentIncome: s.parent_income || "",
              status: s.status,
              registeredAt: formatSqlDateTime(s.registered_at),
              documents: parsedDocs,
              dynamicAnswers: safeJsonParse(s.dynamic_answers_json, {}),
              schoolOrigin: s.school_origin || void 0
            };
          }
        } catch (e) {
        }
      }
      if (!matchedStudent) {
        matchedStudent = memoryStore.students.find(
          (s) => s.registrationNumber.toLowerCase() === cleanIdent || s.id.toLowerCase() === cleanIdent || cleanPhone.length >= 8 && s.parentPhone && s.parentPhone.replace(/[^0-9]/g, "") === cleanPhone || s.nisn && s.nisn === cleanIdent
        );
      }
      if (matchedStudent) {
        isVirtualStudentUser = true;
        matchedUser = {
          id: `usr-${matchedStudent.id}`,
          name: matchedStudent.parentName || `Wali Siswa ${matchedStudent.fullName}`,
          email: `${matchedStudent.registrationNumber.toLowerCase()}@siswa.arrisalahaceh.or.id`,
          phone: matchedStudent.parentPhone,
          schoolId: matchedStudent.unit,
          role: "Wali Siswa",
          permissions: ["Portal Wali", "Anak Saya", "Pembayaran", "Profil"],
          isActive: true,
          lastLogin: (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").substring(0, 19),
          studentId: matchedStudent.id,
          studentRegistrationNumber: matchedStudent.registrationNumber
        };
      }
    }
    if (!matchedUser) {
      addAuditLog("login", "MASTER", `Gagal masuk: Identitas "${identifier}" tidak terdaftar.`, identifier, ipAddress);
      return { success: false, error: "Kredensial tidak cocok dengan data pendaftaran atau akun sistem." };
    }
    if (!matchedUser.isActive) {
      addAuditLog("login", matchedUser.schoolId, `Gagal masuk: Akun "${matchedUser.email}" dinonaktifkan.`, matchedUser.email, ipAddress);
      return { success: false, error: "Akun Anda sedang dinonaktifkan oleh administrator yayasan." };
    }
    let isPasswordValid = false;
    if (passwordHashInDb) {
      try {
        isPasswordValid = bcrypt.compareSync(passwordPlain, passwordHashInDb);
      } catch (e) {
        isPasswordValid = false;
      }
    } else if (isVirtualStudentUser) {
      addAuditLog("login", matchedUser.schoolId, `Gagal masuk: Pendaftar ${matchedUser.email} belum memiliki akun portal Wali terdaftar.`, matchedUser.email, ipAddress);
      return {
        success: false,
        error: "Nomor pendaftaran ini belum terhubung ke akun Wali aktif. Silakan masuk dengan akun Wali Anda atau daftar akun Wali baru."
      };
    }
    if (!isPasswordValid) {
      addAuditLog("login", matchedUser.schoolId, `Gagal masuk: Kata sandi salah untuk "${matchedUser.email}".`, matchedUser.email, ipAddress);
      return { success: false, error: "Kata sandi atau PIN keamanan yang Anda masukkan salah." };
    }
    let matchedRole = null;
    if (matchedUser.email === "master@dev.com" || matchedUser.role === "Super Admin Yayasan") {
      matchedRole = memoryStore.roles.find(
        (r) => r.id === "role-master" || r.name.includes("Super Admin")
      );
    } else if (matchedUser.email === "adminyys@dev.com" || matchedUser.role && matchedUser.role.includes("Admin Yayasan") && !matchedUser.role.includes("Super")) {
      matchedRole = memoryStore.roles.find(
        (r) => r.id === "role-admin-yys" || r.name.includes("Admin Yayasan") && !r.name.includes("Super")
      );
    } else {
      matchedRole = memoryStore.roles.find(
        (r) => r.name === matchedUser.role || r.id === matchedUser.role
      );
    }
    if (matchedRole && Array.isArray(matchedRole.permissions)) {
      matchedUser.permissions = [...matchedRole.permissions];
    }
    const safeUser = sanitizeUserForClient(matchedUser);
    const SESSION_SECRET = process.env.SESSION_SECRET || "ppdb_arrisalah_aceh_session_secret_2026";
    const expiresAtMs = Date.now() + SESSION_TTL_MS;
    const payload = `${safeUser.id}:${expiresAtMs}`;
    const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    const sessionToken = `sess_${safeUser.id}_${expiresAtMs}_${sig}`;
    const expiresAt = new Date(expiresAtMs);
    activeSessions.set(sessionToken, {
      token: sessionToken,
      user: safeUser,
      expiresAt: expiresAtMs,
      ipAddress
    });
    matchedUser.lastLogin = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").substring(0, 19);
    safeUser.lastLogin = matchedUser.lastLogin;
    if (mysqlPool && isMySqlConnected) {
      mysqlPool.query("UPDATE users SET last_login = ? WHERE id = ?", [safeUser.lastLogin, safeUser.id]).catch((e) => {
      });
    }
    addAuditLog("login", safeUser.schoolId, `Berhasil masuk: ${safeUser.name} (${safeUser.role})`, safeUser.email, ipAddress);
    persistStore();
    return {
      success: true,
      token: sessionToken,
      user: safeUser,
      expiresAt: expiresAt.toISOString()
    };
  },
  createSessionForUser: (user, ipAddress = "127.0.0.1") => {
    const safeUser = sanitizeUserForClient(user);
    const SESSION_SECRET = process.env.SESSION_SECRET || "ppdb_arrisalah_aceh_session_secret_2026";
    const expiresAtMs = Date.now() + SESSION_TTL_MS;
    const payload = `${safeUser.id}:${expiresAtMs}`;
    const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    const sessionToken = `sess_${safeUser.id}_${expiresAtMs}_${sig}`;
    const expiresAt = new Date(expiresAtMs);
    activeSessions.set(sessionToken, {
      token: sessionToken,
      user: safeUser,
      expiresAt: expiresAtMs,
      ipAddress
    });
    return {
      token: sessionToken,
      expiresAt: expiresAt.toISOString(),
      user: safeUser
    };
  },
  verifySessionToken: (token) => {
    if (!token || typeof token !== "string") return null;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const revokedExp = revokedSessionHashes.get(tokenHash);
    if (revokedExp !== void 0) {
      if (Date.now() <= revokedExp) {
        activeSessions.delete(token);
        return null;
      }
      revokedSessionHashes.delete(tokenHash);
    }
    const parseTokenIssuedAt = (tok) => {
      if (!tok.startsWith("sess_")) return 0;
      const sigIdx = tok.lastIndexOf("_");
      const expIdx = sigIdx > 5 ? tok.lastIndexOf("_", sigIdx - 1) : -1;
      if (sigIdx > 5 && expIdx > 5) {
        const expMs = Number(tok.slice(expIdx + 1, sigIdx));
        if (Number.isFinite(expMs)) return expMs - SESSION_TTL_MS;
      }
      return 0;
    };
    const session = activeSessions.get(token);
    if (session) {
      if (Date.now() > session.expiresAt) {
        activeSessions.delete(token);
        return null;
      }
      const freshUser = memoryStore.users.find((u) => u.id === session.user.id);
      const issuedAtMs = parseTokenIssuedAt(token);
      if (!freshUser || !freshUser.isActive || freshUser.sessionInvalidatedAt && issuedAtMs < freshUser.sessionInvalidatedAt) {
        activeSessions.delete(token);
        return null;
      }
      session.user = {
        ...session.user,
        id: freshUser.id,
        name: freshUser.name,
        email: freshUser.email,
        phone: freshUser.phone,
        schoolId: freshUser.schoolId,
        role: freshUser.role,
        isActive: freshUser.isActive,
        emailVerified: freshUser.emailVerified,
        childrenIds: freshUser.childrenIds || session.user.childrenIds,
        studentId: freshUser.studentId || session.user.studentId,
        studentRegistrationNumber: freshUser.studentRegistrationNumber || session.user.studentRegistrationNumber
      };
      const matchedRole = memoryStore.roles.find(
        (r) => r.name === session.user.role || r.id === session.user.role || session.user.email === "adminyys@dev.com" && (r.id === "role-admin-yys" || r.name.includes("Admin Yayasan")) || session.user.email === "master@dev.com" && (r.id === "role-master" || r.name.includes("Super Admin"))
      );
      if (matchedRole && Array.isArray(matchedRole.permissions)) {
        session.user.permissions = [...matchedRole.permissions];
      }
      return session.user;
    }
    if (token.startsWith("sess_")) {
      try {
        const sigIdx = token.lastIndexOf("_");
        const expIdx = sigIdx > 5 ? token.lastIndexOf("_", sigIdx - 1) : -1;
        if (sigIdx > 5 && expIdx > 5) {
          const userId = token.slice(5, expIdx);
          const expiresAtMs = Number(token.slice(expIdx + 1, sigIdx));
          const clientSig = token.slice(sigIdx + 1);
          const issuedAtMs = expiresAtMs - SESSION_TTL_MS;
          if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return null;
          const SESSION_SECRET = process.env.SESSION_SECRET || "ppdb_arrisalah_aceh_session_secret_2026";
          const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(`${userId}:${expiresAtMs}`).digest("hex");
          const clientSigBuf = Buffer.from(clientSig, "utf8");
          const expectedSigBuf = Buffer.from(expectedSig, "utf8");
          const sigMatch = clientSigBuf.length === expectedSigBuf.length && crypto.timingSafeEqual(clientSigBuf, expectedSigBuf);
          if (sigMatch) {
            const user = memoryStore.users.find((u) => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
            if (user && user.isActive && (!user.sessionInvalidatedAt || issuedAtMs >= user.sessionInvalidatedAt)) {
              const matchedRole = memoryStore.roles.find(
                (r) => r.name === user.role || r.id === user.role || user.email === "adminyys@dev.com" && (r.id === "role-admin-yys" || r.name.includes("Admin Yayasan")) || user.email === "master@dev.com" && (r.id === "role-master" || r.name.includes("Super Admin"))
              );
              if (matchedRole && Array.isArray(matchedRole.permissions)) {
                user.permissions = [...matchedRole.permissions];
              }
              const safeRestored = sanitizeUserForClient(user);
              activeSessions.set(token, {
                token,
                user: safeRestored,
                expiresAt: expiresAtMs,
                ipAddress: "127.0.0.1"
              });
              return safeRestored;
            }
          }
        }
      } catch (e) {
        console.error("[Session Restoration Error]:", e);
      }
    }
    return null;
  },
  revokeSessionToken: (token) => {
    if (token && typeof token === "string") {
      activeSessions.delete(token);
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      let expiresAt = Date.now() + SESSION_TTL_MS;
      if (token.startsWith("sess_")) {
        const sigIdx = token.lastIndexOf("_");
        const expIdx = sigIdx > 5 ? token.lastIndexOf("_", sigIdx - 1) : -1;
        if (sigIdx > 5 && expIdx > 5) {
          const parsedExp = Number(token.slice(expIdx + 1, sigIdx));
          if (Number.isFinite(parsedExp) && parsedExp > Date.now()) {
            expiresAt = parsedExp;
          }
        }
      }
      revokedSessionHashes.set(tokenHash, expiresAt);
      memoryStore.revokedSessionHashes = Array.from(revokedSessionHashes.entries()).map(([hash, exp]) => ({
        hash,
        expiresAt: exp
      }));
      persistStore();
    }
    return true;
  },
  invalidateUserSessions: (userId) => {
    const target = memoryStore.users.find((u) => u.id === userId);
    invalidateUserSessions(userId, target?.email);
    persistStore();
    return true;
  },
  // One-Time Cryptographic Password Reset Tokens (15m TTL, SHA-256 hashed, single-use)
  createPasswordResetToken: (identifier) => {
    const clean = String(identifier || "").trim().toLowerCase();
    if (!clean) {
      return { success: false, error: "Email atau ID akun wajib diisi." };
    }
    const cleanPhone = clean.replace(/\D/g, "");
    const user = memoryStore.users.find(
      (u) => u.id === identifier || u.email.toLowerCase() === clean || cleanPhone.length >= 9 && (u.phone || "").replace(/\D/g, "") === cleanPhone
    );
    if (!user || !user.isActive) {
      return { success: false, notFound: true, error: "Akun aktif tidak ditemukan." };
    }
    const lastSent = passwordResetCooldowns.get(user.id) || 0;
    const now = Date.now();
    if (now - lastSent < RESET_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((RESET_COOLDOWN_MS - (now - lastSent)) / 1e3);
      return {
        success: false,
        cooldownSeconds: remainingSeconds,
        error: `Silakan tunggu ${remainingSeconds} detik lagi sebelum meminta tautan reset baru.`
      };
    }
    for (const [hash, rec] of passwordResetTokens.entries()) {
      if (rec.userId === user.id) {
        passwordResetTokens.delete(hash);
      }
    }
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = now + RESET_TOKEN_TTL_MS;
    passwordResetTokens.set(tokenHash, {
      tokenHash,
      userId: user.id,
      email: user.email,
      expiresAt,
      createdAt: now
    });
    passwordResetCooldowns.set(user.id, now);
    memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
    persistStore();
    return {
      success: true,
      rawToken,
      user: sanitizeUserForClient(user),
      expiresAt,
      cooldownSeconds: 60
    };
  },
  verifyPasswordResetToken: (rawToken) => {
    const cleanToken = String(rawToken || "").trim();
    if (!/^[a-f0-9]{64}$/i.test(cleanToken)) {
      return { valid: false, error: "Tautan reset kata sandi tidak valid." };
    }
    const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");
    const rec = passwordResetTokens.get(tokenHash);
    if (!rec || Date.now() > rec.expiresAt) {
      if (rec) {
        passwordResetTokens.delete(tokenHash);
        memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
        persistStore();
      }
      return { valid: false, error: "Tautan reset kata sandi telah kedaluwarsa atau sudah digunakan." };
    }
    const user = memoryStore.users.find((u) => u.id === rec.userId && u.isActive);
    if (!user) {
      passwordResetTokens.delete(tokenHash);
      memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
      persistStore();
      return { valid: false, error: "Akun terkait tidak aktif atau tidak ditemukan." };
    }
    const [localPart, domain] = user.email.split("@");
    const maskedLocal = localPart.length <= 2 ? `${localPart[0] || "*"}*` : `${localPart.slice(0, 2)}***`;
    return {
      valid: true,
      emailMasked: domain ? `${maskedLocal}@${domain}` : maskedLocal
    };
  },
  consumePasswordResetToken: async (rawToken, newPassword, ipAddress = "127.0.0.1") => {
    const cleanToken = String(rawToken || "").trim();
    if (!/^[a-f0-9]{64}$/i.test(cleanToken)) {
      return { success: false, error: "Token reset kata sandi tidak valid." };
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return { success: false, error: "Kata sandi baru minimal 8 karakter." };
    }
    const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");
    const rec = passwordResetTokens.get(tokenHash);
    if (!rec || Date.now() > rec.expiresAt) {
      if (rec) {
        passwordResetTokens.delete(tokenHash);
        memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
        persistStore();
      }
      return { success: false, error: "Token reset sudah kedaluwarsa atau telah dipakai sebelumnya." };
    }
    passwordResetTokens.delete(tokenHash);
    memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
    const userIdx = memoryStore.users.findIndex((u) => u.id === rec.userId && u.isActive);
    if (userIdx === -1) {
      persistStore();
      return { success: false, error: "Akun pengguna tidak ditemukan atau tidak aktif." };
    }
    const user = memoryStore.users[userIdx];
    const hashedPwd = bcrypt.hashSync(newPassword, 10);
    await executeMySql("UPDATE users SET password_hash = ? WHERE id = ?", [hashedPwd, user.id]);
    user.passwordHash = hashedPwd;
    user.sessionInvalidatedAt = Date.now();
    invalidateUserSessions(user.id, user.email);
    persistStore();
    addAuditLog(
      "update_status",
      user.schoolId || "MASTER",
      `Reset kata sandi akun "${user.email}" berhasil melalui token verifikasi satu kali`,
      user.email,
      ipAddress
    );
    return {
      success: true,
      message: "Kata sandi baru berhasil disimpan dan semua sesi lama telah dicabut. Silakan masuk kembali."
    };
  },
  // -------------------------------------------------------------
  // Real Database Explorer (Master-Only with Encrypted PIN Guard)
  // -------------------------------------------------------------
  verifyRealDbPin: (pinPlain, ipAddress = "127.0.0.1") => {
    const cleanPin = (pinPlain || "").trim();
    const envHashRaw = process.env.REAL_DB_PIN_HASH || "";
    const envHash = envHashRaw.replace(/^["']+|["']+$/g, "").trim();
    const defaultHash1 = "$2b$10$7Ncfg3UJPaoAJhivL.sOfuJBYoatekgSYV3A.MmUWXKMkwSz6ar16";
    const defaultHash2 = "$2b$10$vrpcelmdl.C327jshq0Deux9YNSeJYDbNansST3UFFSpGFNW.7T6y";
    const hashesToTry = [envHash, defaultHash1, defaultHash2].filter((h) => h && h.length > 20);
    let isPinValid = false;
    for (const h of hashesToTry) {
      try {
        if (bcrypt.compareSync(cleanPin, h)) {
          isPinValid = true;
          break;
        }
      } catch (e) {
      }
    }
    if (!isPinValid) {
      addAuditLog(
        "unauthorized_access",
        "MASTER",
        `Percobaan PIN Real Database Explorer GAGAL dari IP ${ipAddress}`,
        "master@dev.com",
        ipAddress
      );
      return { success: false, error: "PIN Keamanan Database tidak sesuai. Akses ditolak." };
    }
    const dbAccessToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 30 * 60 * 1e3;
    realDbAccessTokens.set(dbAccessToken, { expiresAt, ipAddress });
    addAuditLog(
      "login",
      "MASTER",
      `Otorisasi PIN Real Database Explorer BERHASIL (Master)`,
      "master@dev.com",
      ipAddress
    );
    return {
      success: true,
      token: dbAccessToken,
      expiresAt: new Date(expiresAt).toISOString()
    };
  },
  verifyRealDbAccessToken: (token) => {
    if (!token) return false;
    const session = realDbAccessTokens.get(token);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      realDbAccessTokens.delete(token);
      return false;
    }
    return true;
  },
  revokeRealDbAccessToken: (token) => {
    if (token) {
      realDbAccessTokens.delete(token);
    }
    return true;
  },
  getRealDbTables: async () => {
    const ALLOWED_TABLES = [
      { name: "units", label: "Tabel Kuota & Biaya (units)" },
      { name: "students", label: "Tabel Pendaftar & Siswa (students)" },
      { name: "payments", label: "Tabel Transaksi & Bukti Pembayaran (payments)" },
      { name: "test_schedules", label: "Tabel Jadwal Tes Seleksi (test_schedules)" },
      { name: "form_schemas", label: "Tabel Skema Form Builder (form_schemas)" },
      { name: "roles", label: "Tabel Role & Hak Akses (roles)" },
      { name: "users", label: "Tabel Pengguna & Kata Sandi (users)" },
      { name: "academic_years", label: "Tabel Periode Tahun Ajaran (academic_years)" },
      { name: "landing_config", label: "Tabel Konfigurasi Web Landing (landing_config)" },
      { name: "audit_logs", label: "Tabel Security Audit Trail (audit_logs)" },
      { name: "trash_items", label: "Tabel Sampah / Trash Data (trash_items)" }
    ];
    const result = [];
    for (const t of ALLOWED_TABLES) {
      let count = 0;
      if (mysqlPool && isMySqlConnected) {
        try {
          const [rows] = await mysqlPool.query(`SELECT COUNT(*) as cnt FROM \`${t.name}\``);
          if (Array.isArray(rows) && rows[0]) {
            count = Number(rows[0].cnt) || 0;
          }
        } catch (e) {
          count = 0;
        }
      } else {
        const storeKeyMap = {
          units: "units",
          students: "students",
          payments: "payments",
          test_schedules: "schedules",
          form_schemas: "formSchemas",
          roles: "roles",
          users: "users",
          academic_years: "academicYears",
          landing_config: "landingConfig",
          audit_logs: "auditLogs",
          trash_items: "trashItems"
        };
        const sk = storeKeyMap[t.name];
        if (sk) {
          const val = memoryStore[sk];
          count = Array.isArray(val) ? val.length : 1;
        }
      }
      result.push({
        name: t.name,
        label: t.label,
        rowCount: count,
        isLiveMySQL: isMySqlConnected
      });
    }
    return result;
  },
  getRealDbTableData: async (tableName, page = 1, limit = 25, search = "") => {
    const ALLOWED_TABLES = [
      "units",
      "students",
      "payments",
      "test_schedules",
      "form_schemas",
      "roles",
      "users",
      "academic_years",
      "landing_config",
      "audit_logs",
      "trash_items"
    ];
    if (!ALLOWED_TABLES.includes(tableName)) {
      throw new Error("Nama tabel tidak diizinkan atau tidak ditemukan.");
    }
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const offset = (safePage - 1) * safeLimit;
    if (mysqlPool && isMySqlConnected) {
      const [colRows] = await mysqlPool.query(`SHOW COLUMNS FROM \`${tableName}\``);
      const columns2 = Array.isArray(colRows) ? colRows.map((c) => ({
        name: c.Field,
        type: c.Type,
        nullable: c.Null === "YES",
        key: c.Key,
        default: c.Default
      })) : [];
      const [countRows] = await mysqlPool.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);
      const total2 = Number(countRows[0]?.total) || 0;
      const [dataRows] = await mysqlPool.query(
        `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`,
        [safeLimit, offset]
      );
      const sanitizedMySqlRows = (Array.isArray(dataRows) ? dataRows : []).map((r) => {
        if (tableName === "users" && r && typeof r === "object") {
          const { password_hash: _omit1, passwordHash: _omit2, ...rest } = r;
          return { ...rest, password_hash: rest ? "********" : void 0 };
        }
        return r;
      });
      return {
        tableName,
        columns: columns2,
        rows: sanitizedMySqlRows,
        total: total2,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total2 / safeLimit) || 1,
        isLiveMySQL: true,
        connectionInfo: {
          host: process.env.MYSQL_HOST || "localhost",
          port: Number(process.env.MYSQL_PORT) || 3306,
          database: process.env.MYSQL_DATABASE || "ppdb_arrisalah",
          user: process.env.MYSQL_USER || "root"
        }
      };
    }
    const storeKeyMap = {
      units: "units",
      students: "students",
      payments: "payments",
      test_schedules: "schedules",
      form_schemas: "formSchemas",
      roles: "roles",
      users: "users",
      academic_years: "academicYears",
      landing_config: "landingConfig",
      audit_logs: "auditLogs",
      trash_items: "trashItems"
    };
    const storeKey = storeKeyMap[tableName];
    let storeData = [];
    if (storeKey) {
      const val = memoryStore[storeKey];
      storeData = Array.isArray(val) ? val : [val];
    }
    const total = storeData.length;
    const rawPaginated = storeData.slice(offset, offset + safeLimit);
    const paginated = tableName === "users" ? rawPaginated.map((row) => sanitizeUserForClient(row)) : rawPaginated;
    const allKeys = /* @__PURE__ */ new Set();
    storeData.forEach((item) => {
      if (item && typeof item === "object") {
        Object.keys(item).forEach((k) => {
          if (tableName === "users" && (k === "passwordHash" || k === "password_hash")) return;
          allKeys.add(k);
        });
      }
    });
    const columns = Array.from(allKeys).map((k) => {
      const sampleVal = storeData.find((item) => item && item[k] !== void 0)?.[k];
      return {
        name: k,
        type: typeof sampleVal,
        nullable: true,
        key: k === "id" ? "PRI" : "",
        default: null
      };
    });
    return {
      tableName,
      columns,
      rows: paginated,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
      isLiveMySQL: false,
      connectionInfo: {
        host: "Persistent In-Memory Storage",
        port: 3306,
        database: "ppdb_store.json",
        user: "ppdb_admin"
      }
    };
  },
  // Trash / Sampah Management (Master Admin Only)
  getTrashItems: () => {
    const items = Array.isArray(memoryStore.trashItems) ? memoryStore.trashItems : [];
    return items.map((item) => sanitizeTrashItemForClient(item));
  },
  restoreTrashItem: async (trashId, restoredBy = "Master Admin") => {
    const items = Array.isArray(memoryStore.trashItems) ? memoryStore.trashItems : [];
    const target = items.find((item) => item.id === trashId);
    if (!target) {
      return { success: false, statusCode: 404, error: "Item sampah tidak ditemukan." };
    }
    const snap = target.snapshot || {};
    if (target.entityType === "student") {
      const student = snap.student;
      if (!student || !student.id) {
        return { success: false, statusCode: 400, error: "Snapshot data siswa di sampah tidak valid." };
      }
      if (memoryStore.students.some((s) => s.id === student.id)) {
        return { success: false, statusCode: 409, error: `Data siswa "${student.fullName}" sudah ada di daftar aktif.` };
      }
      if (memoryStore.students.some((s) => s.registrationNumber === student.registrationNumber)) {
        return {
          success: false,
          statusCode: 409,
          error: `Nomor registrasi ${student.registrationNumber} sudah dipakai pendaftar aktif lain.`
        };
      }
      const validScheduleId = student.testScheduleId && memoryStore.schedules.some((sc) => sc.id === student.testScheduleId) ? student.testScheduleId : void 0;
      const restoredStudent = { ...student, testScheduleId: validScheduleId };
      await executeMySql(
        `INSERT INTO students (id, registration_number, parent_user_id, full_name, nisn, unit, gender, birth_place, birth_date, address, parent_name, parent_phone, parent_job, parent_income, status, registered_at, documents_json, dynamic_answers_json, verification_notes, test_score, test_schedule_id, test_published, is_offline, track, school_origin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          restoredStudent.id,
          restoredStudent.registrationNumber,
          restoredStudent.parentUserId || null,
          restoredStudent.fullName.slice(0, 200),
          restoredStudent.nisn || null,
          restoredStudent.unit,
          restoredStudent.gender || "Laki-laki",
          (restoredStudent.birthPlace || "").trim().slice(0, 100),
          toSqlDateOrNull(restoredStudent.birthDate),
          restoredStudent.address || "",
          (restoredStudent.parentName || "").trim().slice(0, 150),
          (restoredStudent.parentPhone || "").trim().slice(0, 30),
          (restoredStudent.parentJob || "").trim().slice(0, 100),
          (restoredStudent.parentIncome || "").trim().slice(0, 100),
          restoredStudent.status || "verifikasi",
          formatSqlDateTime(restoredStudent.registeredAt, formatSqlDateTime(/* @__PURE__ */ new Date())),
          JSON.stringify(restoredStudent.documents || {}),
          JSON.stringify(restoredStudent.dynamicAnswers || {}),
          restoredStudent.verificationNotes || null,
          restoredStudent.testScore ?? null,
          restoredStudent.testScheduleId || null,
          restoredStudent.testPublished ? 1 : 0,
          restoredStudent.isOffline ? 1 : 0,
          restoredStudent.track || null,
          restoredStudent.schoolOrigin || null
        ]
      );
      memoryStore.students.push(restoredStudent);
      const archivedPayments = Array.isArray(snap.payments) ? snap.payments : [];
      for (const p of archivedPayments) {
        if (!p || !p.id) continue;
        if (!memoryStore.payments.some((ep) => ep.id === p.id)) {
          await executeMySql(
            `INSERT IGNORE INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, proof_url, verified_by, verification_notes, bank_account)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id,
              p.registrationId,
              p.registrationNumber,
              p.studentName,
              p.unit,
              p.type,
              Number(p.amount) || 0,
              p.status,
              formatSqlDateTime(p.date, formatSqlDateTime(/* @__PURE__ */ new Date())),
              p.proofUrl || null,
              p.verifiedBy || null,
              p.verificationNotes || null,
              p.bankAccount || ""
            ]
          );
          memoryStore.payments.push(p);
        }
      }
      const targetUnitObj = memoryStore.units.find((u) => u.id === restoredStudent.unit);
      const nextOnline = memoryStore.students.filter((s) => s.unit === restoredStudent.unit).length;
      const offlineCnt = Math.max(0, Number(targetUnitObj?.offlineCount) || 0);
      const nextFilled = nextOnline + offlineCnt;
      await executeMySql("UPDATE units SET filled_quota = ? WHERE id = ?", [nextFilled, restoredStudent.unit]);
      memoryStore.units = memoryStore.units.map(
        (u) => u.id === restoredStudent.unit ? { ...u, onlineCount: nextOnline, offlineCount: offlineCnt, filledQuota: nextFilled } : u
      );
      if (restoredStudent.parentUserId) {
        memoryStore.users = memoryStore.users.map((u) => {
          if (u.id === restoredStudent.parentUserId) {
            const cIds = Array.isArray(u.childrenIds) ? u.childrenIds : [];
            if (!cIds.includes(restoredStudent.id)) {
              return { ...u, childrenIds: [...cIds, restoredStudent.id] };
            }
          }
          return u;
        });
      }
      addAuditLog("update_status", restoredStudent.unit, `Pulihkan data siswa "${restoredStudent.fullName}" (${restoredStudent.registrationNumber}) dari Sampah`, restoredBy);
    } else if (target.entityType === "schedule") {
      const sch = snap.schedule;
      if (!sch || !sch.id) {
        return { success: false, statusCode: 400, error: "Snapshot jadwal tes di sampah tidak valid." };
      }
      if (memoryStore.schedules.some((sc) => sc.id === sch.id)) {
        return { success: false, statusCode: 409, error: `Jadwal tes "${sch.title}" sudah ada di daftar aktif.` };
      }
      await executeMySql(
        `INSERT INTO test_schedules (id, title, unit, test_date, start_time, end_time, room, examiner, quota, filled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sch.id,
          sch.title,
          sch.unit,
          formatSqlDate(sch.date, (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)),
          sch.startTime,
          sch.endTime,
          sch.room,
          sch.examiner,
          Number(sch.quota) || 40,
          Number(sch.filled) || 0
        ]
      );
      memoryStore.schedules.push(sch);
      const linkedIds = Array.isArray(snap.linkedStudentIds) ? snap.linkedStudentIds : [];
      for (const sid of linkedIds) {
        const st = memoryStore.students.find((s) => s.id === sid);
        if (st && !st.testScheduleId) {
          await executeMySql("UPDATE students SET test_schedule_id = ? WHERE id = ?", [sch.id, sid]);
          st.testScheduleId = sch.id;
        }
      }
      addAuditLog("update_status", sch.unit, `Pulihkan jadwal tes "${sch.title}" dari Sampah`, restoredBy);
    } else if (target.entityType === "role") {
      const role = snap.role;
      if (!role || !role.id) {
        return { success: false, statusCode: 400, error: "Snapshot role di sampah tidak valid." };
      }
      if (memoryStore.roles.some((r) => r.id === role.id || r.name.toLowerCase() === role.name.toLowerCase())) {
        return { success: false, statusCode: 409, error: `Role "${role.name}" sudah aktif di sistem.` };
      }
      await executeMySql(
        `INSERT INTO roles (id, name, school_id, permissions_json, description, user_count) VALUES (?, ?, ?, ?, ?, ?)`,
        [role.id, role.name, role.schoolId || "MASTER", JSON.stringify(role.permissions || []), role.description || "", Number(role.userCount) || 0]
      );
      memoryStore.roles.push(role);
      addAuditLog("update_status", "MASTER", `Pulihkan role "${role.name}" dari Sampah`, restoredBy);
    } else if (target.entityType === "user") {
      const userObj = snap.user;
      if (!userObj || !userObj.id || !userObj.email) {
        return { success: false, statusCode: 400, error: "Snapshot akun pengguna di sampah tidak valid." };
      }
      if (memoryStore.users.some((u) => u.id === userObj.id || u.email.toLowerCase() === userObj.email.toLowerCase())) {
        return {
          success: false,
          statusCode: 409,
          error: `Akun dengan email "${userObj.email}" sudah terdaftar di sistem aktif.`
        };
      }
      const pwdHash = snap.passwordHash || bcrypt.hashSync(crypto.randomBytes(18).toString("base64url"), 10);
      await executeMySql(
        `INSERT INTO users (id, name, email, phone, school_id, role, permissions_json, is_active, email_verified, children_ids_json, password_hash, last_login)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userObj.id,
          userObj.name,
          userObj.email,
          userObj.phone || "",
          userObj.schoolId || "MASTER",
          userObj.role,
          JSON.stringify(userObj.permissions || []),
          userObj.isActive ? 1 : 0,
          userObj.emailVerified ? 1 : 0,
          JSON.stringify(userObj.childrenIds || []),
          pwdHash,
          userObj.lastLogin || "-"
        ]
      );
      memoryStore.users.push({ ...userObj, passwordHash: pwdHash });
      addAuditLog("update_status", userObj.schoolId || "MASTER", `Pulihkan akun "${userObj.name}" (${userObj.email}) dari Sampah`, restoredBy);
    } else if (target.entityType === "form_section") {
      const unitId = String(snap.unitId || "");
      const section = snap.section;
      if (!unitId || !section || !section.id) {
        return { success: false, statusCode: 400, error: "Snapshot seksi Form Builder tidak valid." };
      }
      const existingSchema = memoryStore.formSchemas.find((s) => s.unitId === unitId) || { unitId, sections: [] };
      if (existingSchema.sections.some((sec) => sec.id === section.id)) {
        return { success: false, statusCode: 409, error: `Seksi "${section.title}" sudah ada di Form Builder unit ${unitId}.` };
      }
      await db.updateFormSchema(
        unitId,
        { unitId, sections: [...existingSchema.sections, section] },
        restoredBy,
        "Super Admin Yayasan",
        true
      );
      addAuditLog("update_status", unitId, `Pulihkan seksi Form Builder "${section.title}" unit ${unitId} dari Sampah`, restoredBy);
    } else if (target.entityType === "form_field") {
      const unitId = String(snap.unitId || "");
      const { sectionId, sectionTitle, field } = snap;
      if (!unitId || !field || !field.id) {
        return { success: false, statusCode: 400, error: "Snapshot field Form Builder tidak valid." };
      }
      const existingSchema = memoryStore.formSchemas.find((s) => s.unitId === unitId) || { unitId, sections: [] };
      if (existingSchema.sections.some((sec) => Array.isArray(sec.fields) && sec.fields.some((f) => f.id === field.id))) {
        return { success: false, statusCode: 409, error: `Field "${field.label}" sudah ada di Form Builder unit ${unitId}.` };
      }
      const nextSections = [...existingSchema.sections];
      const secIdx = nextSections.findIndex((sec) => sec.id === sectionId);
      if (secIdx >= 0) {
        nextSections[secIdx] = {
          ...nextSections[secIdx],
          fields: [...nextSections[secIdx].fields || [], field]
        };
      } else {
        nextSections.push({
          id: sectionId || `sec-restored-${Date.now()}`,
          title: sectionTitle || "Seksi Dipulihkan",
          fields: [field]
        });
      }
      await db.updateFormSchema(unitId, { unitId, sections: nextSections }, restoredBy, "Super Admin Yayasan", true);
      addAuditLog("update_status", unitId, `Pulihkan field Form Builder "${field.label}" unit ${unitId} dari Sampah`, restoredBy);
    } else if (target.entityType === "landing_slide") {
      const slide = snap.slide;
      if (!slide || !slide.id) {
        return { success: false, statusCode: 400, error: "Snapshot slide hero tidak valid." };
      }
      const currLanding = db.getLandingConfig();
      const slides = Array.isArray(currLanding.heroSlides) ? [...currLanding.heroSlides] : [];
      if (slides.some((s) => s.id === slide.id)) {
        return { success: false, statusCode: 409, error: `Slide "${slide.title || slide.id}" sudah ada di Landing Page.` };
      }
      await db.updateLandingConfig({ ...currLanding, heroSlides: [...slides, slide] }, restoredBy, "Super Admin Yayasan", true);
      addAuditLog("update_status", "MASTER", `Pulihkan slide hero "${slide.title || "Banner"}" dari Sampah`, restoredBy);
    } else if (target.entityType === "landing_step") {
      const step = snap.step;
      if (!step || !step.title) {
        return { success: false, statusCode: 400, error: "Snapshot langkah alur landing tidak valid." };
      }
      const currLanding = db.getLandingConfig();
      const steps = Array.isArray(currLanding.flowSteps) ? [...currLanding.flowSteps] : [];
      if (steps.some((st) => st.step === step.step && st.title === step.title)) {
        return { success: false, statusCode: 409, error: `Langkah alur "${step.title}" sudah ada di Landing Page.` };
      }
      steps.push(step);
      steps.sort((a, b) => Number(a.step) - Number(b.step));
      await db.updateLandingConfig({ ...currLanding, flowSteps: steps }, restoredBy, "Super Admin Yayasan", true);
      addAuditLog("update_status", "MASTER", `Pulihkan alur pendaftaran "${step.title}" dari Sampah`, restoredBy);
    } else if (target.entityType === "landing_requirement") {
      const reqText = typeof snap.requirement === "string" ? snap.requirement.trim() : "";
      if (!reqText) {
        return { success: false, statusCode: 400, error: "Snapshot syarat pendaftaran tidak valid." };
      }
      const currLanding = db.getLandingConfig();
      const reqs = Array.isArray(currLanding.requirements) ? [...currLanding.requirements] : [];
      if (reqs.some((r) => String(r).trim() === reqText)) {
        return { success: false, statusCode: 409, error: "Syarat pendaftaran tersebut sudah ada di Landing Page." };
      }
      await db.updateLandingConfig({ ...currLanding, requirements: [...reqs, reqText] }, restoredBy, "Super Admin Yayasan", true);
      addAuditLog("update_status", "MASTER", `Pulihkan syarat pendaftaran "${reqText.slice(0, 60)}" dari Sampah`, restoredBy);
    } else if (target.entityType === "smtp_account") {
      const acc = snap.account;
      if (!acc || !acc.senderEmail) {
        return { success: false, statusCode: 400, error: "Snapshot akun SMTP tidak valid." };
      }
      const currSmtp = db.getSmtpConfig();
      const accounts = Array.isArray(currSmtp.accounts) ? [...currSmtp.accounts] : [];
      if (accounts.some((a) => a.senderEmail.toLowerCase() === acc.senderEmail.toLowerCase())) {
        return { success: false, statusCode: 409, error: `Akun SMTP ${acc.senderEmail} sudah terdaftar aktif.` };
      }
      const nextPayload = {
        ...currSmtp,
        accounts: [...accounts, acc]
      };
      await executeMySql(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('smtp_config', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [JSON.stringify(nextPayload)]
      );
      memoryStore.smtpConfig = nextPayload;
      addAuditLog("smtp_config", "MASTER", `Pulihkan akun SMTP ${acc.senderEmail} dari Sampah`, restoredBy);
    } else {
      return { success: false, statusCode: 400, error: `Tipe entitas "${target.entityType}" belum didukung untuk pemulihan.` };
    }
    await executeMySql("DELETE FROM trash_items WHERE id = ?", [trashId]);
    memoryStore.trashItems = items.filter((item) => item.id !== trashId);
    persistStore();
    return {
      success: true,
      entityType: target.entityType,
      message: `Data "${target.title}" berhasil dipulihkan dari Sampah.`
    };
  },
  saveUploadedBufferToDisk: (buffer, prefix, ext) => {
    return saveBufferToUploadsDirs(buffer, prefix, ext);
  },
  deleteUploadFileIfUnused: (fileUrl) => {
    return deleteUploadFileSafely(fileUrl);
  },
  permanentlyDeleteTrashItem: async (trashId, actor = "Master Admin") => {
    const items = Array.isArray(memoryStore.trashItems) ? memoryStore.trashItems : [];
    const target = items.find((item) => item.id === trashId);
    if (!target) return false;
    const candidateUploadUrls = /* @__PURE__ */ new Set();
    collectUploadUrlsFromValue(target.snapshot, candidateUploadUrls);
    await executeMySql("DELETE FROM trash_items WHERE id = ?", [trashId]);
    memoryStore.trashItems = items.filter((item) => item.id !== trashId);
    for (const url of candidateUploadUrls) {
      deleteUploadFileSafely(url);
    }
    addAuditLog("update_status", "MASTER", `Hapus permanen item "${target.title}" (${target.entityType}) dari Sampah oleh ${actor}`, actor);
    persistStore();
    return true;
  },
  emptyTrash: async (actor = "Master Admin") => {
    const items = Array.isArray(memoryStore.trashItems) ? memoryStore.trashItems : [];
    const count = items.length;
    const candidateUploadUrls = /* @__PURE__ */ new Set();
    for (const item of items) {
      collectUploadUrlsFromValue(item?.snapshot, candidateUploadUrls);
    }
    await executeMySql("DELETE FROM trash_items");
    memoryStore.trashItems = [];
    for (const url of candidateUploadUrls) {
      deleteUploadFileSafely(url);
    }
    addAuditLog("update_status", "MASTER", `Kosongkan seluruh Sampah (${count} item dihapus permanen) oleh ${actor}`, actor);
    persistStore();
    return count;
  },
  cleanupExpiredSessions: () => {
    const now = Date.now();
    for (const [token, session] of activeSessions.entries()) {
      if (now > session.expiresAt) {
        activeSessions.delete(token);
      }
    }
    for (const [token, record] of realDbAccessTokens.entries()) {
      if (now > record.expiresAt) {
        realDbAccessTokens.delete(token);
      }
    }
    let resetChanged = false;
    for (const [hash, record] of passwordResetTokens.entries()) {
      if (now > record.expiresAt) {
        passwordResetTokens.delete(hash);
        resetChanged = true;
      }
    }
    if (resetChanged) {
      memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
    }
    let revokedChanged = false;
    for (const [hash, exp] of revokedSessionHashes.entries()) {
      if (now > exp) {
        revokedSessionHashes.delete(hash);
        revokedChanged = true;
      }
    }
    if (revokedChanged) {
      memoryStore.revokedSessionHashes = Array.from(revokedSessionHashes.entries()).map(([hash, exp]) => ({
        hash,
        expiresAt: exp
      }));
    }
    if (resetChanged || revokedChanged) {
      persistStore();
    }
    for (const [uid, ts] of passwordResetCooldowns.entries()) {
      if (now - ts > RESET_COOLDOWN_MS) {
        passwordResetCooldowns.delete(uid);
      }
    }
  }
};
var activeSessions = /* @__PURE__ */ new Map();
var realDbAccessTokens = /* @__PURE__ */ new Map();

// src/utils/rbac.ts
var MODULE_ACTIONS = [
  {
    module: "Dashboard",
    label: "Dashboard Overview",
    actions: [
      { key: "view", label: "Lihat Dashboard" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Pendaftar",
    label: "Data Pendaftar",
    actions: [
      { key: "view", label: "Lihat Data" },
      { key: "add", label: "Tambah Pendaftar" },
      { key: "edit", label: "Ubah Data" },
      { key: "delete", label: "Hapus Data" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Verifikasi",
    label: "Verifikasi Berkas",
    actions: [
      { key: "view", label: "Lihat Berkas" },
      { key: "verify", label: "Verifikasi / Approve / Tolak" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Jadwal",
    label: "Jadwal Tes Seleksi",
    actions: [
      { key: "view", label: "Lihat Jadwal" },
      { key: "add", label: "Tambah Jadwal" },
      { key: "edit", label: "Ubah Jadwal" },
      { key: "delete", label: "Hapus Jadwal" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Kelulusan",
    label: "Penetapan Kelulusan",
    actions: [
      { key: "view", label: "Lihat Hasil Tes" },
      { key: "edit", label: "Penetapan Lulus/Tidak Lulus" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Pembayaran",
    label: "Verifikasi Pembayaran",
    actions: [
      { key: "view", label: "Lihat Mutasi/Bukti" },
      { key: "verify", label: "Konfirmasi Lunas/Tolak" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Laporan",
    label: "Laporan Keuangan",
    actions: [
      { key: "view", label: "Lihat Laporan" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Form Builder",
    label: "Form Builder Dinamis",
    actions: [
      { key: "view", label: "Lihat Skema" },
      { key: "edit", label: "Ubah/Simpan Skema" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Kuota & Biaya",
    label: "Kuota & Tarif Biaya",
    actions: [
      { key: "view", label: "Lihat Kuota" },
      { key: "edit", label: "Ubah Kuota & Biaya" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Tahun Ajaran",
    label: "Periode Tahun Ajaran",
    actions: [
      { key: "view", label: "Lihat Periode" },
      { key: "add", label: "Tambah Periode" },
      { key: "edit", label: "Aktivasi Periode" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Kelola Landing",
    label: "Kelola Landing Page",
    actions: [
      { key: "view", label: "Lihat Landing CMS" },
      { key: "edit", label: "Ubah Content Landing" }
    ]
  },
  {
    module: "Manajemen Role",
    label: "Manajemen Role & Akses",
    actions: [
      { key: "view", label: "Lihat Role" },
      { key: "add", label: "Tambah Role" },
      { key: "edit", label: "Ubah Role" },
      { key: "delete", label: "Hapus Role" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Kelola Users",
    label: "Kelola Pengguna Staf",
    actions: [
      { key: "view", label: "Lihat Users" },
      { key: "add", label: "Tambah User" },
      { key: "edit", label: "Ubah User" },
      { key: "delete", label: "Hapus User" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Audit Log",
    label: "Security Audit Log",
    actions: [
      { key: "view", label: "Lihat Audit Log" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Status Sistem",
    label: "Status Arsitektur Sistem",
    actions: [
      { key: "view", label: "Lihat Diagnostik" },
      { key: "export", label: "Ekspor Data (Excel/PDF)" }
    ]
  },
  {
    module: "Kelola Export",
    label: "Kelola Ekspor Data Tabel",
    actions: [
      { key: "view", label: "Lihat Aturan Ekspor" },
      { key: "edit", label: "Ubah Aturan Ekspor" }
    ]
  },
  {
    module: "Konfigurasi SMTP",
    label: "Konfigurasi SMTP Google",
    actions: [
      { key: "view", label: "Lihat Pengaturan SMTP" },
      { key: "edit", label: "Ubah Pengaturan SMTP" }
    ]
  },
  {
    module: "Link Grup Siswa",
    label: "Kelola Link Grup Siswa & Wali",
    actions: [
      { key: "view", label: "Lihat Link Grup" },
      { key: "edit", label: "Ubah Link Grup & Aturan" }
    ]
  },
  {
    module: "Kelola Kontak",
    label: "Kontak Unit Sekolah & Yayasan",
    actions: [
      { key: "view", label: "Lihat Kontak Unit" },
      { key: "edit", label: "Ubah Informasi Kontak" }
    ]
  },
  {
    module: "Rekening Yayasan",
    label: "Rekening Bank Yayasan (Multi-Bank)",
    actions: [
      { key: "view", label: "Lihat Rekening" },
      { key: "add", label: "Tambah Rekening" },
      { key: "edit", label: "Ubah Rekening" },
      { key: "delete", label: "Hapus Rekening" }
    ]
  }
];

// server.ts
var SERVER_MODULE_DIR = path2.dirname(fileURLToPath2(import.meta.url));
var PROJECT_ROOT2 = fs2.existsSync(path2.join(SERVER_MODULE_DIR, "package.json")) ? SERVER_MODULE_DIR : process.cwd();
dotenv2.config({ path: path2.resolve(PROJECT_ROOT2, ".env") });
dotenv2.config();
var ENV_PLACEHOLDER_APP_URL = "https://ppdb.sekolahanda.sch.id";
function getConfiguredAppUrl(req) {
  const rawEnv = String(process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (rawEnv) {
    try {
      const parsed = new URL(rawEnv);
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.origin.toLowerCase() !== ENV_PLACEHOLDER_APP_URL) {
        return rawEnv;
      }
    } catch {
    }
  }
  if (req) {
    const fwdProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
    const proto = fwdProto === "https" || req.secure ? "https" : req.protocol || "http";
    const host = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim() || String(req.get("host") || "").trim();
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  }
  return "https://ppdb.arrisalahaceh.or.id";
}
var ALL_VALID_PERMISSIONS = new Set(
  MODULE_ACTIONS.flatMap((m) => [m.module, ...m.actions.map((a) => `${m.module}:${a.key}`)])
);
var SUPER_ADMIN_ONLY_MODULES = /* @__PURE__ */ new Set([
  "Manajemen Role",
  "Status Sistem",
  "Audit Log",
  "Konfigurasi SMTP",
  "Kelola Export"
]);
function escapeHtml(val) {
  return String(val ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function isSafeHttpUrl(val, allowRelativeUploads = false) {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (allowRelativeUploads && (trimmed.startsWith("/uploads/") || trimmed.startsWith("/src/assets/"))) {
    return !trimmed.includes("..");
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
function verifyBufferMagicBytes(buf, expectedKind) {
  if (!buf || buf.length < 4) return false;
  switch (expectedKind) {
    case "png":
      return buf.length >= 8 && buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71 && buf[4] === 13 && buf[5] === 10 && buf[6] === 26 && buf[7] === 10;
    case "jpg":
    case "jpeg":
      return buf[0] === 255 && buf[1] === 216 && buf[2] === 255;
    case "webp":
      return buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
    case "ico":
      return buf[0] === 0 && buf[1] === 0 && (buf[2] === 1 || buf[2] === 2) && buf[3] === 0;
    case "pdf":
      return buf.subarray(0, 5).toString("ascii") === "%PDF-";
    default:
      return false;
  }
}
function verifyDataUriPayload(rawData, options = {}) {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const regex = options.allowPdf ? options.allowIco ? /^data:(image\/(?:png|jpeg|jpg|webp|x-icon|vnd\.microsoft\.icon)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/i : /^data:(image\/(?:png|jpeg|jpg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/i : options.allowIco ? /^data:image\/(png|jpeg|jpg|webp|x-icon|vnd\.microsoft\.icon);base64,([A-Za-z0-9+/=]+)$/i : /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i;
  const match = rawData.match(regex);
  if (!match) {
    return { ok: false, error: "Format tipe MIME file tidak diizinkan." };
  }
  const mime = match[1].toLowerCase();
  const base64Body = match[2];
  const buffer = Buffer.from(base64Body, "base64");
  if (buffer.length === 0 || buffer.length > maxBytes) {
    return { ok: false, error: `Ukuran file tidak valid atau melebihi batas maksimal ${Math.round(maxBytes / (1024 * 1024))}MB.` };
  }
  let ext = "png";
  let expectedKind = "png";
  if (mime === "application/pdf") {
    ext = "pdf";
    expectedKind = "pdf";
  } else if (mime.includes("jpeg") || mime.includes("jpg")) {
    ext = "jpg";
    expectedKind = "jpg";
  } else if (mime.includes("webp")) {
    ext = "webp";
    expectedKind = "webp";
  } else if (mime.includes("icon")) {
    ext = "ico";
    expectedKind = "ico";
  }
  const magicValid = expectedKind === "ico" ? verifyBufferMagicBytes(buffer, "ico") || verifyBufferMagicBytes(buffer, "png") : verifyBufferMagicBytes(buffer, expectedKind);
  if (!magicValid) {
    return { ok: false, error: "Signature biner (magic bytes) file tidak cocok dengan ekstensi yang diklaim." };
  }
  return { ok: true, ext, buffer };
}
function getEnvCloudflareConfig() {
  const rawEnabled = (process.env.CLOUDFLARE_ENABLED ?? process.env.CLOUDFLARE_TURNSTILE_ENABLED ?? "false").trim().toLowerCase();
  const enabled = rawEnabled === "true" || rawEnabled === "1" || rawEnabled === "yes";
  const siteKey = (process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || "").trim();
  const secretKey = (process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "").trim();
  return { enabled, siteKey, secretKey };
}
async function verifyTurnstileServer(token, remoteIp) {
  const config = getEnvCloudflareConfig();
  if (!config.enabled) {
    return { success: true };
  }
  if (typeof token !== "string" || token.trim().length < 10 || token.length > 4096) {
    return { success: false, error: "Verifikasi keamanan Cloudflare Turnstile wajib diselesaikan." };
  }
  const secret = config.secretKey;
  if (!secret) {
    return {
      success: false,
      error: "Konfigurasi CLOUDFLARE_TURNSTILE_SECRET_KEY di .env server belum lengkap. Silakan hubungi administrator."
    };
  }
  try {
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token.trim(),
        remoteip: remoteIp || ""
      })
    });
    if (!verifyRes.ok) {
      return { success: false, error: "Gagal memvalidasi token Cloudflare Turnstile." };
    }
    const data = await verifyRes.json();
    if (data && data.success === true) {
      return { success: true };
    }
    return { success: false, error: "Verifikasi bot Cloudflare Turnstile gagal atau kedaluwarsa. Silakan ulangi verifikasi." };
  } catch (err) {
    console.error("[Turnstile Verify Error]:", err);
    return { success: false, error: "Layanan verifikasi Cloudflare Turnstile tidak dapat dijangkau." };
  }
}
async function sendMailWithActiveSmtp(params) {
  const smtp = db.getSmtpConfig();
  if (!smtp.enabled) {
    return { sent: false, error: "Layanan email SMTP belum diaktifkan oleh administrator yayasan." };
  }
  const accounts = db.getDecryptedSmtpAccounts().filter((a) => a.isActive && a.authPassword);
  if (accounts.length === 0) {
    return { sent: false, error: "Belum ada akun SMTP aktif dengan App Password yang dikonfigurasi." };
  }
  let lastError = "";
  for (const acc of accounts) {
    try {
      const transporter = nodemailer.createTransport({
        host: acc.host || "smtp.gmail.com",
        port: acc.port || 465,
        secure: acc.secure !== void 0 ? acc.secure : true,
        auth: {
          user: acc.senderEmail,
          pass: acc.authPassword.replace(/\s+/g, "")
        },
        connectionTimeout: 9e3
      });
      await transporter.sendMail({
        from: `"${acc.senderName || smtp.senderName || "PPDB Yayasan Ar-Risalah"}" <${acc.senderEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments
      });
      return { sent: true, usedAccount: acc.senderEmail };
    } catch (err) {
      lastError = err?.message || "Gagal terhubung ke server SMTP.";
    }
  }
  return { sent: false, error: lastError || "Gagal mengirim email melalui seluruh akun SMTP." };
}
function maskEmailAddress(email) {
  const clean = String(email || "").trim();
  const [localPart, domain] = clean.split("@");
  if (!localPart) return "***";
  const maskedLocal = localPart.length <= 2 ? `${localPart[0] || "*"}*` : `${localPart.slice(0, 2)}***`;
  return domain ? `${maskedLocal}@${domain}` : maskedLocal;
}
function sanitizeEmailSubjectText(val) {
  return String(val ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
function resolveGuardianEmailForStudent(student, allUsers, unitSchema) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isCleanEmail = (v) => typeof v === "string" && emailRegex.test(v.trim()) && !v.includes("\r") && !v.includes("\n");
  const parentUser = allUsers.find((u) => {
    if (student?.parentUserId && u.id === student.parentUserId) return true;
    if (student && Array.isArray(u.childrenIds) && u.childrenIds.includes(student.id)) return true;
    if (student && u.studentId && u.studentId === student.id) return true;
    if (student && u.studentRegistrationNumber && u.studentRegistrationNumber === student.registrationNumber) {
      return true;
    }
    return false;
  });
  if (parentUser) {
    const cleanEmail = isCleanEmail(parentUser.email) ? parentUser.email.trim() : "";
    const parentName = parentUser.name || student?.parentName || "Bapak/Ibu Wali Murid";
    if (!cleanEmail) {
      return {
        email: "",
        parentName,
        emailVerified: false,
        reason: "Email wali murid tidak ditemukan atau formatnya tidak valid."
      };
    }
    if (parentUser.emailVerified !== true) {
      return {
        email: cleanEmail,
        parentName,
        emailVerified: false,
        reason: "Email wali murid belum diverifikasi."
      };
    }
    return {
      email: cleanEmail,
      parentName,
      emailVerified: true
    };
  }
  const answers = student?.dynamicAnswers;
  let candidateEmail = "";
  if (answers && typeof answers === "object") {
    const sections = Array.isArray(unitSchema?.sections) ? unitSchema.sections : [];
    outer: for (const sec of sections) {
      for (const f of sec?.fields || []) {
        const label = String(f?.label || "").toLowerCase();
        if (f?.type === "email" || label.includes("email")) {
          const val = answers[f.id];
          if (isCleanEmail(val)) {
            candidateEmail = val.trim();
            break outer;
          }
        }
      }
    }
    if (!candidateEmail) {
      for (const [k, val] of Object.entries(answers)) {
        if (/email/i.test(k) && isCleanEmail(val)) {
          candidateEmail = val.trim();
          break;
        }
      }
    }
  }
  if (candidateEmail) {
    const matchedUser = allUsers.find(
      (u) => typeof u?.email === "string" && u.email.trim().toLowerCase() === candidateEmail.toLowerCase()
    );
    if (matchedUser && matchedUser.emailVerified === true) {
      return {
        email: candidateEmail,
        parentName: matchedUser.name || student?.parentName || "Bapak/Ibu Wali Murid",
        emailVerified: true
      };
    }
    return {
      email: candidateEmail,
      parentName: matchedUser?.name || student?.parentName || "Bapak/Ibu Wali Murid",
      emailVerified: false,
      reason: "Email wali murid belum diverifikasi."
    };
  }
  return {
    email: "",
    parentName: student?.parentName || "Bapak/Ibu Wali Murid",
    emailVerified: false,
    reason: "Email wali murid tidak ditemukan pada akun pendaftar terkait."
  };
}
async function sendPaymentRejectionEmailToWali(rejectedPayments, req) {
  try {
    if (!Array.isArray(rejectedPayments) || rejectedPayments.length === 0) {
      return { sent: false, error: "Tidak ada data bukti pembayaran yang ditolak." };
    }
    const primaryPay = rejectedPayments[0];
    const allStudents = db.getStudents();
    const student = (primaryPay.registrationId ? db.getStudentById(primaryPay.registrationId) : void 0) || allStudents.find(
      (s) => primaryPay.registrationId && s.id === primaryPay.registrationId || primaryPay.registrationNumber && s.registrationNumber === primaryPay.registrationNumber
    );
    const allSchemas = db.getFormSchemas();
    const unitId = student?.unit || primaryPay.unit || "";
    const unitSchema = allSchemas.find((fs3) => fs3.unitId === unitId);
    const {
      email: recipientEmail,
      parentName,
      emailVerified,
      reason: emailResolveReason
    } = resolveGuardianEmailForStudent(student, db.getUsers(), unitSchema);
    if (!recipientEmail) {
      return {
        sent: false,
        error: emailResolveReason || "Email wali murid tidak ditemukan pada akun pendaftar terkait."
      };
    }
    if (emailVerified !== true) {
      const recipientMasked2 = maskEmailAddress(recipientEmail);
      console.log(
        `[Mail Payment Reject] Pengiriman email ke ${recipientMasked2} dilewati karena email wali belum diverifikasi.`
      );
      return {
        sent: false,
        recipientMasked: recipientMasked2,
        error: "Email wali murid belum diverifikasi, sehingga notifikasi email tidak dikirim."
      };
    }
    const landingConfig = db.getLandingConfig();
    const appNameFromDb = landingConfig?.appName || "PPDB Yayasan Pendidikan Islam Ar-Risalah Aceh";
    const activeYearLabel = getActiveAcademicYearLabel(db.getAcademicYears());
    const unitObj = db.getUnits().find((u) => u.id === unitId);
    const unitDisplayName = unitObj?.name || unitId || "Unit Pendidikan";
    const unitContacts = db.getUnitContacts();
    const unitContact = unitContacts.find((c) => c.unitId === unitId) || unitContacts.find((c) => c.unitId === "MASTER");
    const contactPhone = unitContact?.whatsapp || unitContact?.phone || landingConfig?.contact?.whatsapp || landingConfig?.contact?.phone || "-";
    const contactEmail = unitContact?.email || landingConfig?.contact?.email || "info@arrisalahaceh.or.id";
    const contactAddress = unitContact?.address || landingConfig?.contact?.address || "Jl. BTN Kupula Indah, Geulanggang Gampong, Kab. Bireuen, Aceh";
    const studentName = (student ? resolveStudentNameFromSchema(student, unitSchema) : "") || primaryPay.studentName || "Calon Peserta Didik";
    const regNumber = student?.registrationNumber || primaryPay.registrationNumber || "-";
    const billTypeLabel = primaryPay.type === "Daftar Ulang" ? "Biaya Daftar Ulang" : "Biaya Formulir Pendaftaran";
    const rejectionReason = primaryPay.verificationNotes || "Bukti transfer belum valid, buram, atau nominal belum sesuai ketentuan.";
    const totalRejectedAmount = rejectedPayments.reduce(
      (sum, item) => sum + (Number(item?.amount) || 0),
      0
    );
    const portalUrl = getConfiguredAppUrl(req);
    const proofRowsHtml = rejectedPayments.map((item, idx) => {
      const nominalFormatted = `Rp ${(Number(item?.amount) || 0).toLocaleString("id-ID")}`;
      const paidAt = item?.paidAt ? `${item.paidAt} WIB` : "-";
      const method = item?.method || "Transfer Bank";
      return `
          <tr style="border-bottom: 1px solid #fee2e2;">
            <td style="padding: 8px 10px; color: #475569; font-size: 12.5px;">#${idx + 1} (${escapeHtml(method)})</td>
            <td style="padding: 8px 10px; color: #334155; font-size: 12.5px;">${escapeHtml(paidAt)}</td>
            <td style="padding: 8px 10px; font-weight: bold; color: #991b1b; text-align: right; font-size: 12.5px;">${escapeHtml(nominalFormatted)}</td>
          </tr>
        `;
    }).join("");
    const subject = sanitizeEmailSubjectText(
      `[Perlu Perbaikan] Bukti Pembayaran ${billTypeLabel} Ditolak - ${studentName} (${regNumber})`
    );
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #fecaca; border-radius: 16px; overflow: hidden; background: #ffffff;">
        <div style="background-color: #991b1b; color: #ffffff; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 19px; letter-spacing: 0.4px; text-transform: uppercase;">${escapeHtml(appNameFromDb)}</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.92;">Notifikasi Verifikasi Pembayaran PPDB ${escapeHtml(activeYearLabel)}</p>
        </div>

        <div style="padding: 26px 24px; color: #1e293b;">
          <h3 style="color: #991b1b; margin-top: 0; font-size: 16px;">Assalamu'alaikum Warahmatullahi Wabarakatuh</h3>
          <p style="font-size: 13.5px; line-height: 1.6; color: #334155;">
            Yth. Bapak/Ibu <strong>${escapeHtml(parentName)}</strong>,<br/>
            Terima kasih telah mengunggah bukti pembayaran untuk calon peserta didik atas nama <strong>${escapeHtml(studentName)}</strong>. Setelah dilakukan pemeriksaan mutasi dan validasi oleh tim Bendahara/Panitia PPDB, dengan berat hati kami informasikan bahwa bukti pembayaran tersebut <strong>BELUM DAPAT DISETUJUI (DITOLAK)</strong>.
          </p>

          <div style="background-color: #fef2f2; border: 1.5px solid #f87171; border-radius: 12px; padding: 16px; margin: 18px 0;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: bold; color: #b91c1c; display: block; margin-bottom: 6px;">ALASAN PENOLAKAN / CATATAN VERIFIKATOR</span>
            <p style="margin: 0; font-size: 14px; font-weight: bold; color: #7f1d1d; line-height: 1.5;">
              "${escapeHtml(rejectionReason)}"
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 4px; font-weight: bold; color: #64748b; width: 175px;">Nama Calon Siswa</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #0f172a;">: ${escapeHtml(studentName)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 4px; font-weight: bold; color: #64748b;">Nomor Pendaftaran</td>
              <td style="padding: 8px 4px; font-weight: bold; font-family: monospace; color: #14532d;">: ${escapeHtml(regNumber)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 4px; font-weight: bold; color: #64748b;">Unit Pendidikan</td>
              <td style="padding: 8px 4px; font-weight: bold; color: #15803d;">: ${escapeHtml(unitDisplayName)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 4px; font-weight: bold; color: #64748b;">Jenis Tagihan</td>
              <td style="padding: 8px 4px; color: #334155; font-weight: bold;">: ${escapeHtml(billTypeLabel)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 4px; font-weight: bold; color: #64748b;">Jumlah Bukti Ditolak</td>
              <td style="padding: 8px 4px; color: #991b1b; font-weight: bold;">: ${rejectedPayments.length} bukti (Total Rp ${escapeHtml(totalRejectedAmount.toLocaleString("id-ID"))})</td>
            </tr>
          </table>

          <div style="margin-top: 16px; border: 1px solid #fee2e2; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #fff5f5; padding: 8px 10px; font-size: 11.5px; font-weight: bold; color: #991b1b; border-bottom: 1px solid #fee2e2;">
              Rincian Bukti Pembayaran yang Ditolak
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              ${proofRowsHtml}
            </table>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 15px; margin-top: 20px; font-size: 13px; color: #14532d; line-height: 1.6;">
            <strong>Langkah Selanjutnya:</strong>
            <ol style="margin: 6px 0 0 18px; padding: 0;">
              <li>Pastikan nominal transfer, tanggal, dan rekening tujuan sudah sesuai dengan tagihan resmi PPDB.</li>
              <li>Login ke <strong>Portal PPDB</strong> melalui tombol di bawah ini.</li>
              <li>Buka menu <strong>Pembayaran / Upload Bukti Transfer</strong> pada data ananda, lalu unggah ulang foto/struk transfer yang jelas dan terbaca.</li>
            </ol>
          </div>

          <div style="text-align: center; margin: 24px 0 10px 0;">
            <a href="${escapeHtml(portalUrl)}" style="display: inline-block; background-color: #15803d; color: #ffffff; text-decoration: none; font-weight: bold; padding: 13px 26px; border-radius: 10px; font-size: 14px;">
              Buka Portal PPDB &amp; Unggah Ulang Bukti
            </a>
          </div>
          <p style="text-align: center; font-size: 11.5px; color: #64748b; margin-top: 8px; word-break: break-all;">
            Tautan Portal: ${escapeHtml(portalUrl)}
          </p>
        </div>

        <div style="background-color: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11.5px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6;">
          <strong style="color: #1e293b; font-size: 12px;">Panitia PPDB ${escapeHtml(appNameFromDb)}</strong><br/>
          ${escapeHtml(contactAddress)}<br/>
          Telp/WA: ${escapeHtml(contactPhone)} &nbsp;|&nbsp; Email: ${escapeHtml(contactEmail)}
        </div>
      </div>
    `;
    const mailOutcome = await sendMailWithActiveSmtp({
      to: recipientEmail,
      subject,
      html
    });
    const recipientMasked = maskEmailAddress(recipientEmail);
    if (mailOutcome.sent) {
      console.log(
        `[Mail Payment Reject] Notifikasi penolakan terkirim ke ${recipientMasked} (${regNumber}) via ${mailOutcome.usedAccount}`
      );
      return { sent: true, recipientMasked };
    }
    return {
      sent: false,
      recipientMasked,
      error: mailOutcome.error || "Gagal mengirim email notifikasi penolakan."
    };
  } catch (err) {
    console.error("[Mail Payment Reject Error]:", err);
    return {
      sent: false,
      error: err?.message || "Terjadi kesalahan saat memproses notifikasi email penolakan."
    };
  }
}
async function generateStudentCardPdfBuffer(student, schedule, landingConfig, letterConfigs, formSchemas) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });
  const todayFormatted = (/* @__PURE__ */ new Date()).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const allLetters = letterConfigs || db.getLetterConfigs();
  const allSchemas = formSchemas || db.getFormSchemas();
  const letterConfig = allLetters.find((l) => l.unitId === student.unit) || allLetters.find((l) => l.unitId === "MASTER") || {
    committeeChairName: "Ustadz Dr. Rahmat Hidayat, M.A",
    committeeChairNip: "NIPY. 19850412 201001 1 002",
    committeeRoleTitle: "Ketua Panitia PPDB Yayasan",
    letterHeaderTitle: "PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)",
    cardTitle: "KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB",
    issueLocation: "Bireuen",
    issueDate: todayFormatted,
    examInstructions: [
      "1. Peserta wajib hadir 15 menit sebelum pelaksanaan ujian seleksi dimulai.",
      "2. Membawa Kartu Tanda Peserta ini (cetak fisik) dan alat tulis secukupnya.",
      "3. Berpakaian sopan, rapi, dan menutup aurat (busana muslim/muslimah).",
      "4. Orang tua/wali santri wajib mendampingi ananda saat sesi wawancara orang tua."
    ],
    stampNote: "Dokumen ini diterbitkan sah secara elektronik oleh Panitia PPDB Ar-Risalah Aceh."
  };
  const pageWidth = doc.internal.pageSize.getWidth();
  const addressText = landingConfig?.contact?.address || "Jl. BTN Kupula Indah, Geulanggang Gampong (Geulanggang Baro), Kec. Kota Juang, Kab. Bireuen, Aceh";
  const phoneText = landingConfig?.contact?.phone || landingConfig?.contact?.whatsapp || "0812-6900-1234";
  const emailText = landingConfig?.contact?.email || "info@arrisalahaceh.or.id";
  doc.setFillColor(20, 83, 45);
  doc.rect(0, 0, pageWidth, 6, "F");
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 6, pageWidth, 2, "F");
  doc.setTextColor(20, 83, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("YAYASAN AR-RISALAH ACEH", pageWidth / 2, 18, { align: "center" });
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  const headerTitleText = letterConfig.letterHeaderTitle || "PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)";
  doc.text(headerTitleText, pageWidth / 2, 23.5, { align: "center" });
  const activeYearLabel = getActiveAcademicYearLabel(db.getAcademicYears());
  const activeUnitsLabel = db.getUnits().length > 0 ? db.getUnits().map((u) => u.shortName).filter(Boolean).join(", ") : "TKIT, SDIT, SMPIT & SMAIT";
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Tahun Ajaran ${activeYearLabel} \xB7 Jenjang ${activeUnitsLabel}`, pageWidth / 2, 28, { align: "center" });
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${addressText} | Telp/WA: ${phoneText}`, pageWidth / 2, 32.5, { align: "center" });
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.8);
  doc.line(14, 36, pageWidth - 14, 36);
  doc.setLineWidth(0.2);
  doc.line(14, 37.5, pageWidth - 14, 37.5);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(14, 42, pageWidth - 28, 14, 3, 3, "F");
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, 42, pageWidth - 28, 14, 3, 3, "D");
  doc.setTextColor(20, 83, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const cardTitleText = letterConfig.cardTitle || "KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB";
  doc.text(cardTitleText, pageWidth / 2, 49, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(22, 101, 52);
  doc.text(`Unit Pilihan: ${student.unit} \xB7 Dokumen Resmi Verifikasi Peserta`, pageWidth / 2, 53.5, { align: "center" });
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.6);
  doc.roundedRect(14, 60, pageWidth - 28, 16, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("NOMOR REGISTRASI PENDAFTARAN RESMI", 18, 66);
  doc.setFont("courier", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 83, 45);
  doc.text(String(student.registrationNumber || ""), 18, 72.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const regDateText = student.registeredAt ? `Terdaftar: ${student.registeredAt} WIB` : "Status: Berkas Lengkap";
  doc.text(regDateText, pageWidth - 18, 71, { align: "right" });
  const unitFormSchema = allSchemas.find((s) => s.unitId === student.unit) || null;
  const computedRows = getCardBiodataRows(student, allLetters, unitFormSchema);
  const studentRows = computedRows.length > 0 ? computedRows : [["Data Biodata", ": Belum ada kolom biodata dipilih pada Pengaturan Surat unit"]];
  autoTable(doc, {
    startY: 80,
    head: [["Biodata Calon Siswa", "Keterangan"]],
    body: studentRows,
    theme: "plain",
    headStyles: {
      fillColor: [22, 163, 74],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 65, fontStyle: "bold", textColor: [71, 85, 105] },
      1: { fontStyle: "bold", textColor: [15, 23, 42] }
    },
    margin: { left: 14, right: 14 }
  });
  const pageHeight = doc.internal.pageSize.getHeight();
  let finalY = doc.lastAutoTable?.finalY || 135;
  if (finalY + 95 > pageHeight - 14) {
    doc.addPage();
    finalY = 16;
  }
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, finalY + 4, pageWidth - 28, 24, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 83, 45);
  doc.text("JADWAL & LOKASI UJIAN SELEKSI / OBSERVASI", 18, finalY + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  if (schedule) {
    doc.text(`\u2022 Tanggal & Waktu  : ${schedule.date} (Pukul ${schedule.startTime} - ${schedule.endTime} WIB)`, 18, finalY + 16.5);
    doc.text(`\u2022 Ruangan / Tempat : ${schedule.room} (Kampus Yayasan Ar-Risalah Aceh)`, 18, finalY + 21.5);
    if (schedule.examiner) {
      doc.text(`\u2022 Tim Penguji     : ${schedule.examiner}`, 18, finalY + 26.5);
    }
  } else {
    doc.text("\u2022 Tanggal & Waktu  : Mengikuti jadwal gelombang observasi unit (dapat dicek berkala di portal)", 18, finalY + 16.5);
    doc.text("\u2022 Ruangan / Tempat : Kampus Terpadu Yayasan Ar-Risalah Aceh", 18, finalY + 21.5);
  }
  const rulesY = finalY + 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 83, 45);
  doc.text("TATA TERTIB PESERTA UJIAN:", 14, rulesY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const instructions = Array.isArray(letterConfig.examInstructions) && letterConfig.examInstructions.length > 0 ? letterConfig.examInstructions : [
    "1. Peserta wajib hadir 15 menit sebelum pelaksanaan ujian seleksi dimulai.",
    "2. Membawa Kartu Tanda Peserta ini (cetak fisik) dan alat tulis secukupnya.",
    "3. Berpakaian sopan, rapi, dan menutup aurat (busana muslim/muslimah).",
    "4. Orang tua/wali santri wajib mendampingi ananda saat sesi wawancara orang tua."
  ];
  instructions.slice(0, 4).forEach((inst, idx) => {
    doc.text(inst, 14, rulesY + 4.5 + idx * 4);
  });
  const sigY = rulesY + 26;
  const todayStr = (/* @__PURE__ */ new Date()).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const locationText = letterConfig.issueLocation || "Bireuen";
  const issueDateText = letterConfig.issueDate || todayStr;
  const chairTitleText = letterConfig.committeeRoleTitle || "Ketua Panitia PPDB";
  const chairNameText = letterConfig.committeeChairName || "Ustadz Dr. Rahmat Hidayat, M.A";
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Mengetahui,", 30, sigY, { align: "center" });
  doc.text("Orang Tua / Wali Siswa,", 30, sigY + 4.5, { align: "center" });
  doc.text(`${locationText}, ${issueDateText}`, pageWidth - 40, sigY, { align: "center" });
  doc.text(`${chairTitleText},`, pageWidth - 40, sigY + 4.5, { align: "center" });
  const baseUrl = getConfiguredAppUrl();
  const verifyUrl = `${baseUrl}/#verify-ttd?reg=${encodeURIComponent(student.registrationNumber || "")}`;
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 160,
      margin: 1,
      color: { dark: "#14532d", light: "#ffffff" }
    });
  } catch (err) {
    console.error("QR code generation error:", err);
  }
  const resolvedGuardian = resolveGuardianSummaryFromSchema(student, unitFormSchema);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`( ${resolvedGuardian.name || student.parentName || "Wali Siswa"} )`, 30, sigY + 32, { align: "center" });
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", pageWidth - 50, sigY + 6.5, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`( ${chairNameText} )`, pageWidth - 40, sigY + 30, { align: "center" });
    if (letterConfig.committeeChairNip) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(letterConfig.committeeChairNip, pageWidth - 40, sigY + 34, { align: "center" });
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.text(`( ${chairNameText} )`, pageWidth - 40, sigY + 32, { align: "center" });
    if (letterConfig.committeeChairNip) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(letterConfig.committeeChairNip, pageWidth - 40, sigY + 36, { align: "center" });
    }
  }
  doc.setFillColor(240, 253, 244);
  doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageWidth, 10, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(22, 101, 52);
  doc.text(
    `Sekretariat: ${addressText} \xB7 Email: ${emailText}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 4,
    { align: "center" }
  );
  return Buffer.from(doc.output("arraybuffer"));
}
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
var HOST = process.env.HOST || "0.0.0.0";
var isBuiltBundle = import.meta.url.endsWith(".mjs") || import.meta.url.endsWith(".js");
var rawAppMode = (process.env.APP_MODE || process.env.NODE_ENV || "").trim().toLowerCase();
var isProd = rawAppMode === "production" || isBuiltBundle && rawAppMode !== "development";
app.disable("x-powered-by");
var trustProxyEnv = (process.env.TRUST_PROXY || "").trim().toLowerCase();
app.set("trust proxy", trustProxyEnv === "0" || trustProxyEnv === "false" ? false : Number(trustProxyEnv) || 1);
var SESSION_COOKIE_NAME = "ppdb_session";
var CSRF_COOKIE_NAME = "ppdb_csrf";
var SESSION_COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60;
var CSRF_HMAC_SECRET = crypto2.createHash("sha256").update(`csrf:${process.env.SESSION_SECRET || "ppdb_arrisalah_aceh_session_secret_2026"}`).digest("hex");
var RECEIPT_HMAC_SECRET = crypto2.createHash("sha256").update(`receipt:${process.env.SESSION_SECRET || "ppdb_arrisalah_aceh_session_secret_2026"}`).digest("hex");
function computeReceiptSignature(paymentId, registrationNumber) {
  return crypto2.createHmac("sha256", RECEIPT_HMAC_SECRET).update(`${String(paymentId).trim()}:${String(registrationNumber || "").trim().toUpperCase()}`).digest("hex").slice(0, 24);
}
function attachReceiptSig(pay) {
  if (pay && pay.status === "lunas" && pay.id && pay.registrationNumber) {
    return { ...pay, receiptSig: computeReceiptSignature(pay.id, pay.registrationNumber) };
  }
  return pay;
}
function parseCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader || typeof cookieHeader !== "string") return result;
  for (const part of cookieHeader.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (!key || key === "__proto__" || key === "constructor" || key === "prototype") continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}
function computeCsrfToken(sessionToken) {
  return crypto2.createHmac("sha256", CSRF_HMAC_SECRET).update(sessionToken).digest("hex");
}
function timingSafeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto2.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}
function getEffectiveHost(req) {
  const fwdHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim().toLowerCase();
  return fwdHost || String(req.get("host") || "").toLowerCase();
}
function isSecureCookieContext(req) {
  const protoHeader = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  const originHeader = String(req.headers.origin || "").toLowerCase();
  const refererHeader = String(req.headers.referer || "").toLowerCase();
  const appUrlEnv = String(process.env.APP_URL || "").toLowerCase();
  const effectiveHost = getEffectiveHost(req);
  const isLocalHost = effectiveHost.startsWith("localhost") || effectiveHost.startsWith("127.0.0.1");
  return Boolean(
    req.secure || protoHeader.includes("https") || originHeader.startsWith("https://") || refererHeader.startsWith("https://") || appUrlEnv.startsWith("https://") && !isLocalHost
  );
}
function isCrossSiteIframeContext(req) {
  const effectiveHost = getEffectiveHost(req);
  const appUrlEnv = String(process.env.APP_URL || "").toLowerCase();
  const secFetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  const secFetchDest = String(req.headers["sec-fetch-dest"] || "").toLowerCase();
  return Boolean(
    effectiveHost.includes("ais-dev-") || effectiveHost.includes("ais-pre-") || effectiveHost.endsWith(".run.app") || appUrlEnv.includes("ais-dev-") || appUrlEnv.includes("ais-pre-") || appUrlEnv.includes(".run.app") || secFetchSite === "cross-site" || secFetchDest === "iframe"
  );
}
function resolveCookieSameSite(req) {
  const secure = isSecureCookieContext(req);
  if (secure && (!isProd || isCrossSiteIframeContext(req))) {
    return { sameSite: "None", secure: true, partitioned: true };
  }
  if (!isProd) {
    return { sameSite: "Lax", secure: false, partitioned: false };
  }
  const configured = (process.env.COOKIE_SAMESITE || "").trim().toLowerCase();
  if (configured === "strict") {
    return { sameSite: "Strict", secure, partitioned: false };
  }
  if (configured === "lax") {
    return { sameSite: "Lax", secure, partitioned: false };
  }
  if (secure) {
    return { sameSite: "None", secure: true, partitioned: true };
  }
  return { sameSite: "Lax", secure: false, partitioned: false };
}
function serializeCookie(name, value, opts) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${opts.maxAgeSeconds}`,
    `SameSite=${opts.sameSite}`
  ];
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.partitioned && opts.sameSite === "None" && opts.secure) {
    parts.push("Partitioned");
  }
  return parts.join("; ");
}
function setAuthCookies(req, res, sessionToken) {
  const csrfToken = computeCsrfToken(sessionToken);
  const { sameSite, secure, partitioned } = resolveCookieSameSite(req);
  res.setHeader("Set-Cookie", [
    serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
      maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SEC,
      httpOnly: true,
      sameSite,
      secure,
      partitioned
    }),
    serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
      maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SEC,
      httpOnly: false,
      sameSite,
      secure,
      partitioned
    })
  ]);
  return csrfToken;
}
function clearAuthCookies(req, res) {
  const { sameSite, secure, partitioned } = resolveCookieSameSite(req);
  res.setHeader("Set-Cookie", [
    serializeCookie(SESSION_COOKIE_NAME, "", { maxAgeSeconds: 0, httpOnly: true, sameSite, secure, partitioned }),
    serializeCookie(CSRF_COOKIE_NAME, "", { maxAgeSeconds: 0, httpOnly: false, sameSite, secure, partitioned })
  ]);
}
function extractAuthFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = typeof cookies[SESSION_COOKIE_NAME] === "string" ? cookies[SESSION_COOKIE_NAME].trim() : "";
  if (cookieToken) {
    return { token: cookieToken, source: "cookie" };
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) {
      return { token: bearerToken, source: "bearer" };
    }
  }
  return null;
}
function verifyCsrfForCookieMutation(req, sessionToken) {
  const csrfHeader = String(req.headers["x-csrf-token"] || "").trim();
  const expected = computeCsrfToken(sessionToken);
  return timingSafeEqualHex(csrfHeader, expected);
}
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://challenges.cloudflare.com https://generativelanguage.googleapis.com; frame-src 'self' https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'"
  );
  if (isProd && (req.secure || req.headers["x-forwarded-proto"] === "https")) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
var rawAllowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
var allowAllOriginsWildcard = rawAllowedOrigins.includes("*");
var configuredAllowedOrigins = new Set(
  [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.APP_URL || "",
    ...rawAllowedOrigins.filter((o) => o !== "*")
  ].map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)
);
app.use((req, res, next) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim().replace(/\/+$/, "") : "";
  if (!origin) {
    return next();
  }
  let isSameHostOrigin = false;
  let isDevAllowedOrigin = false;
  try {
    const parsedOrigin = new URL(origin);
    const reqHost = req.get("host");
    const fwdHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const origHost = String(req.headers["x-original-host"] || "").split(",")[0].trim();
    if (reqHost && parsedOrigin.host === reqHost || fwdHost && parsedOrigin.host === fwdHost || origHost && parsedOrigin.host === origHost) {
      isSameHostOrigin = true;
    }
    if (!isProd && (parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1" || parsedOrigin.hostname.endsWith(".run.app"))) {
      isDevAllowedOrigin = true;
    }
  } catch {
    isSameHostOrigin = false;
    isDevAllowedOrigin = false;
  }
  if (configuredAllowedOrigins.has(origin) || isSameHostOrigin || isDevAllowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-DB-Access-Token");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  }
  if (allowAllOriginsWildcard || !isProd) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-DB-Access-Token");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  }
  if (req.path.startsWith("/api")) {
    return res.status(403).json({ error: "Akses CORS ditolak: Origin tidak terdaftar pada allowlist." });
  }
  next();
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
var dataUploadsDir = path2.resolve(PROJECT_ROOT2, "data", "uploads");
if (!fs2.existsSync(dataUploadsDir)) {
  fs2.mkdirSync(dataUploadsDir, { recursive: true });
}
var uploadsDir = path2.resolve(PROJECT_ROOT2, "public", "uploads");
if (!fs2.existsSync(uploadsDir)) {
  fs2.mkdirSync(uploadsDir, { recursive: true });
}
function syncUploadsDirectory() {
  try {
    if (fs2.existsSync(dataUploadsDir)) {
      const dataFiles = fs2.readdirSync(dataUploadsDir);
      for (const f of dataFiles) {
        const src = path2.join(dataUploadsDir, f);
        const dst = path2.join(uploadsDir, f);
        if (!fs2.existsSync(dst)) {
          fs2.copyFileSync(src, dst);
        }
      }
    }
    if (fs2.existsSync(uploadsDir)) {
      const publicFiles = fs2.readdirSync(uploadsDir);
      for (const f of publicFiles) {
        const src = path2.join(uploadsDir, f);
        const dst = path2.join(dataUploadsDir, f);
        if (!fs2.existsSync(dst)) {
          fs2.copyFileSync(src, dst);
        }
      }
    }
  } catch (err) {
    console.error("[UploadsSync Error]:", err);
  }
}
function seedDefaultUploadAssets() {
  const crestLogoSrc = path2.resolve(PROJECT_ROOT2, "src", "assets", "images", "logo_arrisalah_crest_1792900905994.jpg");
  if (fs2.existsSync(crestLogoSrc)) {
    const targets = ["logo.png", "logo.jpg", "1000828600.png"];
    for (const t of targets) {
      const pPub = path2.join(uploadsDir, t);
      const pData = path2.join(dataUploadsDir, t);
      if (!fs2.existsSync(pPub)) {
        try {
          fs2.copyFileSync(crestLogoSrc, pPub);
        } catch (e) {
        }
      }
      if (!fs2.existsSync(pData)) {
        try {
          fs2.copyFileSync(crestLogoSrc, pData);
        } catch (e) {
        }
      }
    }
  }
  const faviconTargets = ["favicon.ico", "1000828601.ico"];
  for (const t of faviconTargets) {
    const pPub = path2.join(uploadsDir, t);
    const pData = path2.join(dataUploadsDir, t);
    if (fs2.existsSync(crestLogoSrc)) {
      if (!fs2.existsSync(pPub)) {
        try {
          fs2.copyFileSync(crestLogoSrc, pPub);
        } catch (e) {
        }
      }
      if (!fs2.existsSync(pData)) {
        try {
          fs2.copyFileSync(crestLogoSrc, pData);
        } catch (e) {
        }
      }
    }
  }
}
syncUploadsDirectory();
seedDefaultUploadAssets();
function syncActiveLogoToDefaultFile() {
  try {
    const landing = db.getLandingConfig();
    if (!landing) return;
    const logoDefaultPub = path2.join(uploadsDir, "logo.png");
    const logoDefaultData = path2.join(dataUploadsDir, "logo.png");
    const currentLogoFile = landing.logoUrl ? path2.basename(landing.logoUrl.split("?")[0]) : "";
    if (currentLogoFile && currentLogoFile !== "logo.png") {
      const pubSrc = path2.join(uploadsDir, currentLogoFile);
      const dataSrc = path2.join(dataUploadsDir, currentLogoFile);
      const existingSrc = fs2.existsSync(pubSrc) ? pubSrc : fs2.existsSync(dataSrc) ? dataSrc : "";
      if (existingSrc) {
        try {
          fs2.copyFileSync(existingSrc, logoDefaultPub);
        } catch (e) {
        }
        try {
          fs2.copyFileSync(existingSrc, logoDefaultData);
        } catch (e) {
        }
      } else if (landing.customLogoBase64 && landing.customLogoBase64.startsWith("data:image/")) {
        const buf = Buffer.from(
          landing.customLogoBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, ""),
          "base64"
        );
        try {
          fs2.writeFileSync(logoDefaultPub, buf);
        } catch (e) {
        }
        try {
          fs2.writeFileSync(logoDefaultData, buf);
        } catch (e) {
        }
      }
    } else if (landing.customLogoBase64 && landing.customLogoBase64.startsWith("data:image/")) {
      const buf = Buffer.from(
        landing.customLogoBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, ""),
        "base64"
      );
      try {
        fs2.writeFileSync(logoDefaultPub, buf);
      } catch (e) {
      }
      try {
        fs2.writeFileSync(logoDefaultData, buf);
      } catch (e) {
      }
    }
  } catch (e) {
    console.error("[SyncActiveLogo Error]:", e);
  }
}
app.use(
  "/src/assets/images",
  express.static(path2.resolve(PROJECT_ROOT2, "src", "assets", "images"), {
    maxAge: "7d"
  })
);
function setUploadCacheHeader(res, filename) {
  if (filename === "logo.png" || filename === "logo.jpg" || filename === "favicon.ico") {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
  } else {
    res.setHeader("Cache-Control", "public, max-age=86400");
  }
}
app.get("/uploads/:filename", (req, res, next) => {
  const safeFilename = path2.basename(req.params.filename);
  const publicFile = path2.join(uploadsDir, safeFilename);
  const dataFile = path2.join(dataUploadsDir, safeFilename);
  if (fs2.existsSync(publicFile)) {
    setUploadCacheHeader(res, safeFilename);
    return res.sendFile(publicFile);
  }
  if (fs2.existsSync(dataFile)) {
    try {
      fs2.copyFileSync(dataFile, publicFile);
    } catch (e) {
    }
    setUploadCacheHeader(res, safeFilename);
    return res.sendFile(dataFile);
  }
  try {
    const landing = db.getLandingConfig();
    const currentLogoFile = landing?.logoUrl ? path2.basename(landing.logoUrl) : "";
    const isLogoMatch = safeFilename === currentLogoFile || safeFilename.includes("logo") || landing?.logoUrl && landing.logoUrl.includes(safeFilename);
    if (landing?.customLogoBase64 && isLogoMatch) {
      const logoBuf = Buffer.from(
        landing.customLogoBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, ""),
        "base64"
      );
      fs2.writeFileSync(publicFile, logoBuf);
      try {
        fs2.writeFileSync(dataFile, logoBuf);
      } catch (e) {
      }
      setUploadCacheHeader(res, safeFilename);
      return res.sendFile(publicFile);
    }
    const currentFaviconFile = landing?.faviconUrl ? path2.basename(landing.faviconUrl) : "";
    const isFaviconMatch = safeFilename === currentFaviconFile || safeFilename.includes("favicon") || landing?.faviconUrl && landing.faviconUrl.includes(safeFilename);
    if (landing?.customFaviconBase64 && isFaviconMatch) {
      const favBuf = Buffer.from(
        landing.customFaviconBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, ""),
        "base64"
      );
      fs2.writeFileSync(publicFile, favBuf);
      try {
        fs2.writeFileSync(dataFile, favBuf);
      } catch (e) {
      }
      setUploadCacheHeader(res, safeFilename);
      return res.sendFile(publicFile);
    }
  } catch (e) {
  }
  if (safeFilename.includes("logo") || safeFilename.includes("1000828600")) {
    const defaultLogo = path2.resolve(PROJECT_ROOT2, "src", "assets", "images", "logo_arrisalah_crest_1792900905994.jpg");
    if (fs2.existsSync(defaultLogo)) {
      setUploadCacheHeader(res, safeFilename);
      return res.sendFile(defaultLogo);
    }
  }
  next();
});
app.use("/uploads", express.static(uploadsDir, { maxAge: "1d" }));
var requestCounts = /* @__PURE__ */ new Map();
var authAttemptMap = /* @__PURE__ */ new Map();
var realDbPinRateLimitMap = /* @__PURE__ */ new Map();
var otpAttemptMap = /* @__PURE__ */ new Map();
var lookupAttemptMap = /* @__PURE__ */ new Map();
var uploadAttemptMap = /* @__PURE__ */ new Map();
var RATE_LIMIT_WINDOW_MS = 5 * 60 * 1e3;
var MAX_REQUESTS_UNAUTH = 1e3;
var MAX_REQUESTS_AUTH = 5e3;
var memoryCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) requestCounts.delete(key);
  }
  for (const [key, record] of authAttemptMap.entries()) {
    if (now > record.resetTime) authAttemptMap.delete(key);
  }
  for (const [key, record] of realDbPinRateLimitMap.entries()) {
    if (now > record.resetTime) realDbPinRateLimitMap.delete(key);
  }
  for (const [key, record] of otpAttemptMap.entries()) {
    if (now > record.resetTime) otpAttemptMap.delete(key);
  }
  for (const [key, record] of lookupAttemptMap.entries()) {
    if (now > record.resetTime) lookupAttemptMap.delete(key);
  }
  for (const [key, record] of uploadAttemptMap.entries()) {
    if (now > record.resetTime) uploadAttemptMap.delete(key);
  }
  db.cleanupExpiredSessions();
}, 60 * 1e3);
memoryCleanupTimer.unref();
var createScopedLimiter = (map, windowMs, maxRequests, errorMessage) => {
  return (req, res, next) => {
    if (!isProd) {
      return next();
    }
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const userId = req.user?.id;
    const key = userId ? `u_${userId}` : `ip_${ip}`;
    const now = Date.now();
    const rec = map.get(key);
    if (!rec || now > rec.resetTime) {
      map.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    if (rec.count >= maxRequests) {
      return res.status(429).json({ error: errorMessage });
    }
    rec.count++;
    next();
  };
};
var otpRateLimiter = createScopedLimiter(
  otpAttemptMap,
  10 * 60 * 1e3,
  10,
  "Terlalu banyak permintaan kode OTP. Silakan tunggu beberapa menit."
);
var lookupRateLimiter = createScopedLimiter(
  lookupAttemptMap,
  5 * 60 * 1e3,
  30,
  "Terlalu banyak permintaan pengecekan status. Silakan tunggu 5 menit."
);
var uploadRateLimiter = createScopedLimiter(
  uploadAttemptMap,
  5 * 60 * 1e3,
  40,
  "Terlalu banyak unggahan berkas dalam waktu singkat. Silakan coba lagi sebentar."
);
var rateLimiter = (req, res, next) => {
  const path3 = req.path || "";
  if (!isProd || path3.includes("/health") || path3.includes("/db-status")) {
    return next();
  }
  const extractedAuth = extractAuthFromRequest(req);
  const isAuthSession = Boolean(extractedAuth && extractedAuth.token.startsWith("sess_"));
  const forwardedHeader = req.headers["x-forwarded-for"];
  const clientIp = typeof forwardedHeader === "string" ? forwardedHeader.split(",")[0].trim() : req.ip || req.socket.remoteAddress || "127.0.0.1";
  const clientKey = isAuthSession && extractedAuth ? `sess_${crypto2.createHash("sha256").update(extractedAuth.token).digest("hex").slice(0, 24)}` : `ip_${clientIp}`;
  const maxAllowed = isAuthSession ? MAX_REQUESTS_AUTH : MAX_REQUESTS_UNAUTH;
  const now = Date.now();
  const clientData = requestCounts.get(clientKey);
  if (!clientData || now > clientData.resetTime) {
    if (requestCounts.size > 5e3) {
      for (const [k, r] of requestCounts.entries()) {
        if (now > r.resetTime) requestCounts.delete(k);
      }
    }
    requestCounts.set(clientKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (clientData.count >= maxAllowed) {
    const remainingSeconds = Math.max(1, Math.ceil((clientData.resetTime - now) / 1e3));
    return res.status(429).json({
      error: `Terlalu banyak permintaan (Rate limit exceeded). Silakan coba lagi dalam ${remainingSeconds} detik.`
    });
  }
  clientData.count++;
  next();
};
app.use("/api", rateLimiter);
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    service: "PPDB Yayasan Ar-Risalah Aceh API"
  });
});
app.get("/api/db-status", (req, res) => {
  const status = db.getDbStatus();
  res.json(status);
});
var AUTH_RATE_WINDOW_MS = 60 * 1e3;
var MAX_AUTH_ATTEMPTS = isProd ? 15 : 100;
var authRateLimiter = (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const now = Date.now();
  const attempts = authAttemptMap.get(ip);
  if (!attempts || now > attempts.resetTime) {
    authAttemptMap.set(ip, { count: 1, resetTime: now + AUTH_RATE_WINDOW_MS });
    return next();
  }
  if (attempts.count >= MAX_AUTH_ATTEMPTS) {
    return res.status(429).json({
      error: "Terlalu banyak percobaan masuk. Demi keamanan, silakan tunggu 1 menit."
    });
  }
  attempts.count++;
  next();
};
app.post("/api/auth/login", authRateLimiter, async (req, res) => {
  try {
    const { identifier, password, turnstileToken } = req.body || {};
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const cfCheck = await verifyTurnstileServer(turnstileToken, ip);
    if (!cfCheck.success) {
      return res.status(400).json({ error: cfCheck.error });
    }
    if (!identifier || typeof identifier !== "string" || identifier.trim().length === 0) {
      return res.status(400).json({
        error: "Identitas masuk (Email / No. WhatsApp / No. Pendaftaran) wajib diisi."
      });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({
        error: "Kata sandi atau PIN akun wajib diisi."
      });
    }
    const result = await db.authenticateUser(identifier, password, ip);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    const csrfToken = setAuthCookies(req, res, result.token);
    res.json({
      success: true,
      user: result.user,
      csrfToken,
      expiresAt: result.expiresAt
    });
  } catch (err) {
    console.error("[API Auth Error]:", err);
    res.status(500).json({ error: "Terjadi kesalahan sistem saat memproses autentikasi." });
  }
});
app.get("/api/auth/me", (req, res) => {
  const auth = extractAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ error: "Sesi tidak ditemukan atau kedaluwarsa." });
  }
  const user = db.verifySessionToken(auth.token);
  if (!user) {
    if (auth.source === "cookie") {
      clearAuthCookies(req, res);
    }
    return res.status(401).json({ error: "Sesi Anda telah berakhir. Silakan masuk kembali." });
  }
  const csrfToken = setAuthCookies(req, res, auth.token);
  res.json({ user, csrfToken });
});
app.post("/api/auth/demo-login", authRateLimiter, (req, res) => {
  try {
    if (process.env.ENABLE_DEMO_LOGIN !== "true") {
      return res.status(403).json({
        error: "Fitur demo login dinonaktifkan pada mode produksi. Silakan masuk menggunakan email dan kata sandi resmi Anda."
      });
    }
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email wajib disertakan." });
    }
    const allUsers = db.getUsers();
    const cleanEmail = String(email).trim().toLowerCase();
    const target = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!target) {
      return res.status(404).json({ error: `Akun dengan email "${cleanEmail}" tidak ditemukan di database.` });
    }
    if (!target.isActive) {
      return res.status(403).json({ error: "Akun ini sedang dinonaktifkan oleh administrator yayasan." });
    }
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const session = db.createSessionForUser(target, ip);
    addAuditLog("login", target.schoolId, `Demo login terverifikasi: ${target.name} (${target.role})`, target.email, ip);
    const csrfToken = setAuthCookies(req, res, session.token);
    res.json({
      success: true,
      user: target,
      csrfToken,
      expiresAt: session.expiresAt
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal membuat sesi demo." });
  }
});
app.post("/api/auth/logout", (req, res) => {
  const auth = extractAuthFromRequest(req);
  if (auth) {
    const activeUser = db.verifySessionToken(auth.token);
    if (activeUser && auth.source === "cookie" && !verifyCsrfForCookieMutation(req, auth.token)) {
      return res.status(403).json({ error: "Validasi CSRF logout gagal." });
    }
    db.revokeSessionToken(auth.token);
    if (activeUser) {
      addAuditLog(
        "logout",
        activeUser.schoolId || "MASTER",
        `Keluar dari sesi portal: ${activeUser.name} (${activeUser.role})`,
        activeUser.email,
        req.ip || "127.0.0.1"
      );
    }
  }
  clearAuthCookies(req, res);
  res.json({ success: true, message: "Berhasil keluar." });
});
app.post("/api/auth/forgot-password", authRateLimiter, async (req, res) => {
  try {
    const { identifier, email, turnstileToken } = req.body || {};
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const cfCheck = await verifyTurnstileServer(turnstileToken, ip);
    if (!cfCheck.success) {
      return res.status(400).json({ error: cfCheck.error });
    }
    const targetIdent = String(identifier || email || "").trim();
    if (!targetIdent || targetIdent.length > 180) {
      return res.status(400).json({ error: "Alamat email akun wajib diisi dengan benar." });
    }
    const genericSuccessResponse = {
      success: true,
      message: "Jika alamat email tersebut terdaftar dan aktif, tautan reset kata sandi sekali pakai telah dikirimkan (berlaku 15 menit)."
    };
    const tokenResult = db.createPasswordResetToken(targetIdent);
    if (!tokenResult.success) {
      if (tokenResult.cooldownSeconds) {
        return res.status(429).json({
          error: tokenResult.error,
          cooldownSeconds: tokenResult.cooldownSeconds
        });
      }
      return res.json(genericSuccessResponse);
    }
    const appBaseUrl = getConfiguredAppUrl(req);
    const resetLink = `${appBaseUrl}/?resetToken=${encodeURIComponent(tokenResult.rawToken)}`;
    const mailOutcome = await sendMailWithActiveSmtp({
      to: tokenResult.user.email,
      subject: "\u{1F510} Reset Kata Sandi Portal PPDB Yayasan Ar-Risalah Aceh (Berlaku 15 Menit)",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #16a34a; border-radius: 16px; overflow: hidden; background: #ffffff;">
          <div style="background-color: #14532d; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">YAYASAN AR-RISALAH ACEH</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Permintaan Reset Kata Sandi Portal PPDB</p>
          </div>
          <div style="padding: 28px 24px; color: #1e293b;">
            <p style="font-size: 14px; line-height: 1.6;">
              Assalamu'alaikum <strong>${escapeHtml(tokenResult.user.name)}</strong>,<br/>
              Kami menerima permintaan pengaturan ulang kata sandi untuk akun <strong>${escapeHtml(tokenResult.user.email)}</strong>.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${escapeHtml(resetLink)}" style="display: inline-block; background-color: #15803d; color: #ffffff; text-decoration: none; font-weight: bold; padding: 14px 26px; border-radius: 10px; font-size: 14px;">
                Atur Ulang Kata Sandi Sekarang
              </a>
            </div>
            <p style="font-size: 12px; color: #64748b; word-break: break-all;">
              Jika tombol tidak berfungsi, salin tautan ini ke browser:<br/>${escapeHtml(resetLink)}
            </p>
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px; font-size: 12px; color: #92400e; margin-top: 16px;">
              Tautan ini hanya berlaku <strong>15 menit</strong> untuk <strong>1 kali penggunaan</strong>. Abaikan email ini jika Anda tidak merasa meminta reset kata sandi.
            </div>
          </div>
        </div>
      `
    });
    if (!mailOutcome.sent) {
      addAuditLog(
        "smtp_config",
        tokenResult.user.schoolId || "MASTER",
        `Pengiriman email reset kata sandi untuk ${tokenResult.user.email} gagal: ${mailOutcome.error}`,
        tokenResult.user.email,
        ip
      );
      return res.status(503).json({
        error: "Layanan pengiriman email (SMTP) sedang tidak aktif atau bermasalah. Silakan hubungi administrator yayasan."
      });
    }
    addAuditLog(
      "update_status",
      tokenResult.user.schoolId || "MASTER",
      `Tautan reset kata sandi sekali pakai dikirim ke ${tokenResult.user.email}`,
      tokenResult.user.email,
      ip
    );
    res.json(genericSuccessResponse);
  } catch (err) {
    console.error("[Forgot Password Error]:", err);
    res.status(500).json({ error: "Gagal memproses permintaan reset kata sandi." });
  }
});
app.get("/api/auth/verify-reset-token", (req, res) => {
  const token = String(req.query.token || "").trim();
  const result = db.verifyPasswordResetToken(token);
  if (!result.valid) {
    return res.status(400).json(result);
  }
  res.json(result);
});
app.post("/api/auth/reset-password", authRateLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (typeof token !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ error: "Token reset dan kata sandi baru wajib diisi." });
    }
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const result = await db.consumePasswordResetToken(token, newPassword, ip);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    console.error("[Reset Password Error]:", err);
    res.status(500).json({ error: "Gagal memperbarui kata sandi baru." });
  }
});
var requireAuth = (req, res, next) => {
  const auth = extractAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({
      error: "Autentikasi Diperlukan (401 Unauthorized): Sesi tidak ditemukan."
    });
  }
  const user = db.verifySessionToken(auth.token);
  if (!user) {
    if (auth.source === "cookie") {
      clearAuthCookies(req, res);
    }
    return res.status(401).json({
      error: "Sesi Tidak Valid (401 Unauthorized): Sesi kedaluwarsa atau dicabut. Silakan login kembali."
    });
  }
  if (!user.isActive) {
    if (auth.source === "cookie") {
      clearAuthCookies(req, res);
    }
    return res.status(403).json({
      error: "Akun Dinonaktifkan (403 Forbidden): Akun Anda telah dinonaktifkan oleh administrator yayasan."
    });
  }
  if (auth.source === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) {
    if (!verifyCsrfForCookieMutation(req, auth.token)) {
      return res.status(403).json({
        error: "Validasi Keamanan CSRF Gagal (403 Forbidden): Token CSRF tidak cocok atau tidak disertakan. Silakan muat ulang halaman."
      });
    }
  }
  req.user = user;
  next();
};
var optionalAuth = (req, res, next) => {
  const auth = extractAuthFromRequest(req);
  if (auth) {
    const user = db.verifySessionToken(auth.token);
    if (user && user.isActive) {
      if (auth.source === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) {
        if (!verifyCsrfForCookieMutation(req, auth.token)) {
          return res.status(403).json({
            error: "Validasi Keamanan CSRF Gagal (403 Forbidden): Token CSRF tidak cocok atau tidak disertakan."
          });
        }
      }
      req.user = user;
    }
  }
  next();
};
var requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Autentikasi diperlukan." });
    }
    if (req.user.role === "Super Admin Yayasan" || allowedRoles.includes(req.user.role)) {
      return next();
    }
    addAuditLog(
      "unauthorized_access",
      req.user.schoolId || "MASTER",
      `Percobaan akses tidak sah: Role "${req.user.role}" mencoba mengakses endpoint terproteksi ${req.path}`,
      req.user.email,
      req.ip || "127.0.0.1"
    );
    return res.status(403).json({
      error: `Akses Ditolak (403 Forbidden): Role Anda (${req.user.role}) tidak memiliki izin untuk operasi ini.`
    });
  };
};
var requirePermission = (moduleName, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Autentikasi diperlukan." });
    }
    if (req.user.role === "Super Admin Yayasan") {
      return next();
    }
    const permissions = req.user.permissions || [];
    if (permissions.includes(moduleName)) {
      return next();
    }
    if (action) {
      const actionKey = `${moduleName}:${action}`;
      if (permissions.includes(actionKey)) {
        return next();
      }
    } else {
      const hasAnyAction = permissions.some(
        (p) => p === moduleName || p.startsWith(`${moduleName}:`)
      );
      if (hasAnyAction) {
        return next();
      }
    }
    addAuditLog(
      "unauthorized_access",
      req.user.schoolId || "MASTER",
      `Izin Ditolak: "${req.user.email}" (Role: ${req.user.role}) membutuhkan izin "${action ? `${moduleName}:${action}` : moduleName}" pada ${req.path}`,
      req.user.email,
      req.ip || "127.0.0.1"
    );
    return res.status(403).json({
      error: `Akses Ditolak (403 Forbidden): Anda tidak memiliki izin ${action ? `"${action}"` : "akses"} pada modul ${moduleName}.`
    });
  };
};
var requireMaster = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Autentikasi diperlukan." });
  }
  const roleLower = (req.user.role || "").toLowerCase();
  const isWali = isWaliRoleName(req.user.role);
  const isMaster = !isWali && (req.user.role === "Super Admin Yayasan" || req.user.role === "Admin Yayasan" || roleLower.includes("super admin") || roleLower.includes("admin yayasan"));
  if (!isMaster) {
    return res.status(403).json({
      error: "Akses Ditolak (403 Forbidden): Modul ini khusus Administrator Yayasan (Master)."
    });
  }
  next();
};
var requireUnitIsolation = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Autentikasi diperlukan." });
  }
  if (isWaliRoleName(req.user.role)) {
    return res.status(403).json({
      error: "Akses Ditolak (403 Forbidden): Akun Wali Siswa tidak diizinkan mengakses endpoint staf."
    });
  }
  if (req.user.role === "Super Admin Yayasan" || (req.user.role || "").toLowerCase().includes("admin yayasan") || req.user.schoolId === "MASTER" && !isWaliRoleName(req.user.role)) {
    return next();
  }
  const userUnit = req.user.schoolId;
  const paramUnit = req.params.unitId || (req.path.includes("/units/") ? req.params.id : void 0);
  if (paramUnit && paramUnit !== userUnit) {
    return res.status(403).json({
      error: `Pelanggaran Batas Unit (BOLA): Anda (${userUnit}) dilarang mengubah konfigurasi unit ${paramUnit}.`
    });
  }
  if (req.query.unit && req.query.unit !== "all" && req.query.unit !== userUnit) {
    return res.status(403).json({
      error: `Pelanggaran Batas Unit: Anda tidak memiliki wewenang melihat data unit ${req.query.unit}.`
    });
  }
  if (req.body && req.body.unit && req.body.unit !== userUnit) {
    return res.status(403).json({
      error: `Pelanggaran Batas Unit: Tidak dapat mengarahkan operasi ke unit ${req.body.unit}.`
    });
  }
  if (req.params.id && (req.baseUrl?.includes("students") || req.path.includes("/students/"))) {
    const student = db.getStudentById(req.params.id);
    if (student && student.unit !== userUnit) {
      return res.status(403).json({
        error: `Pelanggaran Privasi Siswa (IDOR): Siswa ini terdaftar di unit ${student.unit}, bukan di unit Anda (${userUnit}).`
      });
    }
  }
  if (req.params.id && req.path.includes("/schedules/")) {
    const allSchedules = db.getSchedules();
    const sch = allSchedules.find((s) => s.id === req.params.id);
    if (sch && sch.unit !== userUnit) {
      return res.status(403).json({
        error: `Pelanggaran Batas Unit: Jadwal tes ini milik unit ${sch.unit}.`
      });
    }
  }
  next();
};
function isWaliRoleName(role) {
  const r = (role || "").toLowerCase();
  return r === "wali siswa" || r === "wali santri" || r === "wali murid" || r.includes("wali");
}
function studentBelongsToWali(student, user) {
  if (!student || !user) return false;
  return Boolean(
    student.parentUserId && student.parentUserId === user.id || Array.isArray(user.childrenIds) && user.childrenIds.includes(student.id) || user.studentId && user.studentId === student.id || user.studentRegistrationNumber && student.registrationNumber === user.studentRegistrationNumber
  );
}
var STUDENT_STAFF_MODULES = ["Dashboard", "Pendaftar", "Verifikasi", "Jadwal", "Kelulusan", "Pembayaran", "Laporan"];
var PAYMENT_STAFF_MODULES = ["Dashboard", "Pembayaran", "Laporan"];
function userHasAnyModulePermission(user, modules) {
  if (!user) return false;
  if (user.role === "Super Admin Yayasan") return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  return modules.some((mod) => perms.some((p) => p === mod || p.startsWith(`${mod}:`)));
}
app.get("/api/students/check-status", lookupRateLimiter, (req, res) => {
  const query = String(req.query.q || req.query.query || "").trim();
  const cleanQ = query.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
  if (!query || cleanQ.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Masukkan Nomor Pendaftaran resmi atau NISN minimal 6 karakter alfanumerik."
    });
  }
  const allStudents = db.getStudents();
  const found = allStudents.find((s) => {
    const regClean = (s.registrationNumber || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
    const nisnClean = (s.nisn || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
    return regClean === cleanQ || nisnClean.length >= 6 && nisnClean === cleanQ;
  });
  if (found) {
    const rawUnitSchema = db.getFormSchemas().find((fs3) => fs3.unitId === found.unit);
    const normUnitSchema = rawUnitSchema ? { ...rawUnitSchema, sections: ensureCoreNameFieldInSections(rawUnitSchema.sections, rawUnitSchema.unitId) } : void 0;
    const resolvedFullName = resolveStudentNameFromSchema(found, normUnitSchema);
    const safeStatus = {
      id: found.id,
      registrationNumber: found.registrationNumber,
      fullName: resolvedFullName,
      nisn: found.nisn,
      unit: found.unit,
      parentName: found.parentName,
      status: found.status,
      testScore: found.testPublished ? found.testScore : void 0,
      testPublished: found.testPublished,
      registeredAt: found.registeredAt
    };
    return res.json({ success: true, student: safeStatus });
  } else {
    return res.json({
      success: false,
      message: `Data pendaftaran dengan nomor registrasi / NISN tersebut tidak ditemukan dalam database resmi PPDB.`
    });
  }
});
app.get("/api/students", requireAuth, (req, res) => {
  const user = req.user;
  let { unit, status, search } = req.query;
  if (isWaliRoleName(user.role)) {
    const allOwn = db.getStudents({
      unit,
      status,
      search
    }).filter((s) => studentBelongsToWali(s, user));
    return res.json(allOwn);
  }
  if (!userHasAnyModulePermission(user, STUDENT_STAFF_MODULES)) {
    return res.status(403).json({
      error: "Akses Ditolak (403 Forbidden): Anda tidak memiliki izin melihat daftar data pendaftar."
    });
  }
  const isGlobalStaff = user.schoolId === "MASTER" || user.role === "Super Admin Yayasan" || user.role.includes("Admin Yayasan");
  if (!isGlobalStaff && user.schoolId) {
    unit = user.schoolId;
  }
  const list = db.getStudents({
    unit,
    status,
    search
  });
  res.json(list);
});
app.get("/api/students/:id", requireAuth, (req, res) => {
  const user = req.user;
  const student = db.getStudentById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: "Calon siswa tidak ditemukan." });
  }
  if (isWaliRoleName(user.role)) {
    if (!studentBelongsToWali(student, user)) {
      return res.status(403).json({ error: "Akses ditolak: Anda hanya berhak melihat data calon siswa milik Anda." });
    }
    return res.json(student);
  }
  if (!userHasAnyModulePermission(user, STUDENT_STAFF_MODULES)) {
    return res.status(403).json({
      error: "Akses Ditolak (403 Forbidden): Anda tidak memiliki izin melihat detail data pendaftar."
    });
  }
  if (user.schoolId !== "MASTER" && user.role !== "Super Admin Yayasan" && !user.role.includes("Admin Yayasan")) {
    if (student.unit !== user.schoolId) {
      return res.status(403).json({ error: "Akses siswa unit lain ditolak." });
    }
  }
  res.json(student);
});
app.post("/api/students", optionalAuth, async (req, res) => {
  try {
    const {
      fullName,
      unit: rawUnit,
      parentName,
      parentPhone,
      parentJob,
      parentIncome,
      nisn,
      gender,
      birthPlace,
      birthDate,
      address,
      schoolOrigin,
      track,
      documents,
      dynamicAnswers
    } = req.body || {};
    const unit = typeof rawUnit === "string" ? rawUnit.trim().toUpperCase() : "";
    const allUnits = db.getUnits();
    const targetUnitConfig = allUnits.find((u) => u.id === unit);
    if (!fullName || typeof fullName !== "string" || fullName.trim().length === 0 || fullName.length > 200) {
      return res.status(400).json({ error: "Nama lengkap calon siswa wajib diisi (maks 200 karakter)." });
    }
    if (!unit || !targetUnitConfig) {
      return res.status(400).json({ error: "Pilihan unit sekolah tidak valid atau tidak terdaftar." });
    }
    const callerPerms = req.user?.permissions || [];
    const isAuthorizedStaffCreator = Boolean(req.user) && !isWaliRoleName(req.user.role) && (req.user.role === "Super Admin Yayasan" || callerPerms.includes("Pendaftar") || callerPerms.includes("Pendaftar:add"));
    if (targetUnitConfig.isOpen === false && !isAuthorizedStaffCreator) {
      return res.status(403).json({
        error: targetUnitConfig.closedNotice || `Pendaftaran untuk unit ${targetUnitConfig.name || unit} saat ini belum dibuka.`
      });
    }
    const remainingQuota = Number(targetUnitConfig.totalQuota) - Number(targetUnitConfig.filledQuota);
    if (remainingQuota <= 0 && !isAuthorizedStaffCreator) {
      return res.status(409).json({
        error: `Kuota pendaftaran untuk unit ${targetUnitConfig.name || unit} telah penuh (${targetUnitConfig.filledQuota}/${targetUnitConfig.totalQuota} kursi terisi). Silakan hubungi panitia PPDB.`
      });
    }
    if (parentName !== void 0 && typeof parentName !== "string") {
      return res.status(400).json({ error: "Format nama orang tua tidak valid." });
    }
    if (parentPhone !== void 0 && typeof parentPhone !== "string") {
      return res.status(400).json({ error: "Format nomor telepon tidak valid." });
    }
    let sanitizedNisn = "";
    if (nisn && typeof nisn === "string" && nisn.trim().length > 0) {
      const cleanNisn = nisn.replace(/\D/g, "");
      if (cleanNisn.length !== 10) {
        return res.status(400).json({ error: "NISN harus tepat 10 digit jika diisi." });
      }
      const existingNisn = db.getStudents().find(
        (s) => s.nisn && s.nisn.trim() === cleanNisn
      );
      if (existingNisn) {
        return res.status(409).json({
          error: `Calon siswa dengan NISN ${cleanNisn} sudah terdaftar sebelumnya (No. Registrasi: ${existingNisn.registrationNumber}). Data tidak boleh duplikat.`
        });
      }
      sanitizedNisn = cleanNisn;
    }
    if (fullName && birthDate && unit) {
      const cleanName = fullName.toLowerCase().trim();
      const existingDuplicate = db.getStudents().find((s) => {
        const matchName = s.fullName.toLowerCase().trim() === cleanName;
        const matchBirth = s.birthDate === birthDate;
        const matchUnit = s.unit === unit;
        return matchName && matchBirth && matchUnit;
      });
      if (existingDuplicate) {
        return res.status(409).json({
          error: `Calon siswa "${fullName}" dengan tanggal lahir ${birthDate} sudah terdaftar pada unit ${unit} (No. Registrasi: ${existingDuplicate.registrationNumber}). Menghindari pendaftaran ganda/duplikat.`
        });
      }
    }
    const isSafeCreateDocValue = (val) => {
      if (val === "") return true;
      if (typeof val !== "string") return false;
      if (val.length > 8 * 1024 * 1024) return false;
      if (val.startsWith("data:")) {
        return verifyDataUriPayload(val, { allowPdf: true }).ok;
      }
      return isSafeHttpUrl(val, true);
    };
    const sanitizedDocs = {};
    if (documents && typeof documents === "object" && !Array.isArray(documents)) {
      for (const [k, v] of Object.entries(documents)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
        if (v === void 0 || v === null || v === "") continue;
        if (!isSafeCreateDocValue(v)) {
          return res.status(400).json({ error: `Format atau konten biner dokumen "${k}" tidak valid (hanya JPG/PNG/WEBP/PDF max 5MB).` });
        }
        sanitizedDocs[k] = String(v);
      }
    }
    const sanitizedAnswers = {};
    if (dynamicAnswers && typeof dynamicAnswers === "object" && !Array.isArray(dynamicAnswers)) {
      for (const [k, v] of Object.entries(dynamicAnswers)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
        if (typeof v === "string" && v.startsWith("data:") && !isSafeCreateDocValue(v)) {
          return res.status(400).json({ error: `Format atau konten biner berkas pada kolom "${k}" tidak diizinkan (hanya JPG/PNG/WEBP/PDF max 5MB).` });
        }
        sanitizedAnswers[k] = v;
      }
    }
    const resolvedParentName = typeof parentName === "string" && parentName.trim() ? parentName.trim().slice(0, 150) : "";
    const resolvedParentPhone = typeof parentPhone === "string" && parentPhone.trim() ? parentPhone.trim().slice(0, 30) : "";
    const cleanPayload = {
      fullName: fullName.trim(),
      nisn: sanitizedNisn,
      unit,
      gender: gender === "Perempuan" ? "Perempuan" : "Laki-laki",
      birthPlace: typeof birthPlace === "string" ? birthPlace.trim().slice(0, 100) : "",
      birthDate: typeof birthDate === "string" ? birthDate.trim().slice(0, 20) : "",
      address: typeof address === "string" ? address.trim().slice(0, 500) : "",
      parentName: resolvedParentName,
      parentPhone: resolvedParentPhone,
      parentJob: typeof parentJob === "string" ? parentJob.trim().slice(0, 100) : "",
      parentIncome: typeof parentIncome === "string" ? parentIncome.trim().slice(0, 60) : "",
      schoolOrigin: typeof schoolOrigin === "string" ? schoolOrigin.trim().slice(0, 150) : void 0,
      track: typeof track === "string" ? track.trim().slice(0, 50) : void 0,
      parentUserId: req.user?.id || (isAuthorizedStaffCreator ? req.body.parentUserId : void 0),
      documents: sanitizedDocs,
      dynamicAnswers: sanitizedAnswers,
      isOffline: false
    };
    const newStudent = await db.createStudent(cleanPayload);
    res.status(201).json(newStudent);
  } catch (err) {
    console.error("[API Create Student Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan pendaftaran siswa ke database." });
  }
});
app.put("/api/students/:id", requireAuth, async (req, res) => {
  try {
    const existing = db.getStudentById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Calon siswa tidak ditemukan." });
    }
    const user = req.user;
    const isSuper = user.role === "Super Admin Yayasan";
    const isWali = isWaliRoleName(user.role);
    let updatesPayload = req.body && typeof req.body === "object" ? { ...req.body } : {};
    if (isWali) {
      if (!studentBelongsToWali(existing, user) && !isSuper) {
        return res.status(403).json({ error: "Akses Ditolak: Anda hanya berhak mengubah data calon siswa milik Anda sendiri." });
      }
      if (!isSuper) {
        const allowedWaliFields = [
          "fullName",
          "nisn",
          "gender",
          "birthPlace",
          "birthDate",
          "address",
          "schoolOrigin",
          "parentName",
          "parentPhone",
          "parentJob",
          "parentIncome",
          "documents",
          "dynamicAnswers"
        ];
        const filtered = {};
        for (const key of allowedWaliFields) {
          if (updatesPayload[key] !== void 0) {
            filtered[key] = updatesPayload[key];
          }
        }
        updatesPayload = filtered;
      }
    } else if (!isSuper) {
      const permissions = user.permissions || [];
      const hasPerm = permissions.includes("Pendaftar") || permissions.includes("Pendaftar:edit") || permissions.includes("Jadwal") || permissions.includes("Jadwal:edit");
      if (!hasPerm) {
        return res.status(403).json({ error: "Akses Ditolak: Anda tidak memiliki izin untuk mengubah data pendaftar." });
      }
      const isYysAdmin = (user.role || "").toLowerCase().includes("admin yayasan");
      if (!isYysAdmin && user.schoolId && user.schoolId !== "MASTER" && existing.unit !== user.schoolId) {
        return res.status(403).json({ error: `Akses Ditolak: Anda hanya berhak mengelola pendaftar unit ${user.schoolId}.` });
      }
    }
    delete updatesPayload.id;
    delete updatesPayload.registrationNumber;
    delete updatesPayload.parentUserId;
    delete updatesPayload.isOffline;
    if (updatesPayload.fullName !== void 0) {
      if (typeof updatesPayload.fullName !== "string" || updatesPayload.fullName.trim().length === 0 || updatesPayload.fullName.length > 200) {
        return res.status(400).json({ error: "Nama lengkap calon siswa tidak valid (1-200 karakter)." });
      }
      updatesPayload.fullName = updatesPayload.fullName.trim();
    }
    if (updatesPayload.nisn !== void 0 && updatesPayload.nisn !== null && String(updatesPayload.nisn).trim().length > 0) {
      const cleanNisn = String(updatesPayload.nisn).replace(/\D/g, "");
      if (cleanNisn.length !== 10) {
        return res.status(400).json({ error: "NISN harus tepat 10 digit angka atau kosongkan bila belum ada." });
      }
      updatesPayload.nisn = cleanNisn;
    }
    const isPlainRecord = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
    const isSafeDocValue = (val) => {
      if (val === "") return true;
      if (typeof val !== "string") return false;
      if (val.length > 8 * 1024 * 1024) return false;
      if (val.startsWith("data:")) {
        return verifyDataUriPayload(val, { allowPdf: true }).ok;
      }
      return isSafeHttpUrl(val, true);
    };
    if (updatesPayload.dynamicAnswers !== void 0) {
      if (!isPlainRecord(updatesPayload.dynamicAnswers)) {
        return res.status(400).json({ error: "Format dynamicAnswers tidak valid." });
      }
      const sanitizedAnswers = {};
      for (const [k, v] of Object.entries(updatesPayload.dynamicAnswers)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
        if (typeof v === "string" && v.startsWith("data:") && !isSafeDocValue(v)) {
          return res.status(400).json({ error: `Format berkas pada kolom "${k}" tidak diizinkan (hanya JPG/PNG/WEBP/PDF max 5MB).` });
        }
        sanitizedAnswers[k] = v;
      }
      updatesPayload.dynamicAnswers = sanitizedAnswers;
    }
    if (updatesPayload.documents !== void 0) {
      if (!isPlainRecord(updatesPayload.documents)) {
        return res.status(400).json({ error: "Format documents tidak valid." });
      }
      const sanitizedDocs = {};
      for (const [k, v] of Object.entries(updatesPayload.documents)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
        if (v === void 0 || v === null) continue;
        if (!isSafeDocValue(v)) {
          return res.status(400).json({ error: `Format dokumen "${k}" tidak valid atau melebihi batas ukuran.` });
        }
        sanitizedDocs[k] = String(v);
      }
      updatesPayload.documents = sanitizedDocs;
    }
    const updated = await db.updateStudent(req.params.id, updatesPayload);
    res.json(updated);
  } catch (err) {
    console.error("[API Update Student Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan pembaruan data calon siswa ke database." });
  }
});
app.delete("/api/students/:id", requireAuth, requirePermission("Pendaftar", "delete"), requireUnitIsolation, async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.name || "Admin";
    const actorRole = req.user?.role || "Staff";
    const success = await db.deleteStudent(req.params.id, actor, actorRole);
    if (!success) {
      return res.status(404).json({ error: "Calon siswa tidak ditemukan." });
    }
    res.json({ message: "Pendaftar berhasil dihapus dan diarsipkan ke Sampah Master." });
  } catch (err) {
    console.error("[API Delete Student Error]:", err);
    res.status(500).json({ error: "Gagal menghapus data pendaftar dari database." });
  }
});
app.post("/api/students/:id/verify", requireAuth, requirePermission("Verifikasi", "verify"), requireUnitIsolation, async (req, res) => {
  try {
    const { approved, notes } = req.body;
    const updated = await db.verifyStudent(req.params.id, Boolean(approved), notes);
    if (!updated) {
      return res.status(404).json({ error: "Calon siswa tidak ditemukan." });
    }
    res.json(updated);
  } catch (err) {
    console.error("[API Verify Student Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan status verifikasi siswa ke database." });
  }
});
app.post("/api/students/:id/test-result", requireAuth, requirePermission("Kelulusan", "edit"), requireUnitIsolation, async (req, res) => {
  try {
    const { score, status, publish } = req.body;
    const numericScore = Number(score);
    if (score === void 0 || score === null || !Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100 || !["lulus", "tidak_lulus"].includes(status)) {
      return res.status(400).json({ error: "Nilai ujian (0 - 100) dan status kelulusan wajib valid." });
    }
    const updated = await db.setTestResult(req.params.id, Math.round(numericScore * 100) / 100, status, Boolean(publish));
    if (!updated) {
      return res.status(404).json({ error: "Calon siswa tidak ditemukan." });
    }
    res.json(updated);
  } catch (err) {
    console.error("[API Set Test Result Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan hasil seleksi ke database." });
  }
});
app.get("/api/payments", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const user = req.user;
  let { unit, status, type } = req.query;
  if (isWaliRoleName(user.role)) {
    const ownIds = new Set(
      db.getStudents().filter((s) => studentBelongsToWali(s, user)).map((s) => s.id)
    );
    const list2 = (await db.getPaymentsFresh({
      unit,
      status,
      type
    })).filter((p) => ownIds.has(p.registrationId)).map(attachReceiptSig);
    return res.json(list2);
  }
  if (!userHasAnyModulePermission(user, PAYMENT_STAFF_MODULES)) {
    return res.status(403).json({
      error: "Akses Ditolak (403 Forbidden): Anda tidak memiliki izin melihat data pembayaran."
    });
  }
  if (user.schoolId !== "MASTER" && user.role !== "Super Admin Yayasan" && !user.role.includes("Admin Yayasan")) {
    unit = user.schoolId;
  }
  const list = (await db.getPaymentsFresh({
    unit,
    status,
    type
  })).map(attachReceiptSig);
  res.json(list);
});
app.post("/api/payments/proof", requireAuth, uploadRateLimiter, async (req, res) => {
  try {
    const { registrationId, proofUrl, amount, type } = req.body;
    if (!registrationId || typeof registrationId !== "string") {
      return res.status(400).json({ error: "ID pendaftaran siswa tidak valid." });
    }
    if (!["Formulir", "Daftar Ulang"].includes(type)) {
      return res.status(400).json({ error: "Jenis pembayaran harus Formulir atau Daftar Ulang." });
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 5e8) {
      return res.status(400).json({ error: "Nominal pembayaran harus lebih dari 0 dan maksimal Rp 500.000.000." });
    }
    if (typeof proofUrl !== "string" || proofUrl.trim().length === 0 || proofUrl.length > 8e6) {
      return res.status(400).json({ error: "Bukti pembayaran tidak valid atau melebihi batas ukuran (maks 5MB)." });
    }
    const trimmedProof = proofUrl.trim();
    let validatedDataCheck = null;
    if (trimmedProof.startsWith("data:")) {
      const check = verifyDataUriPayload(trimmedProof, { allowPdf: true });
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      validatedDataCheck = { ext: check.ext, buffer: check.buffer };
    } else if (!isSafeHttpUrl(trimmedProof, true)) {
      return res.status(400).json({ error: "Format URL bukti transfer tidak diizinkan (gunakan file JPG, PNG, WebP, atau PDF)." });
    }
    const student = db.getStudentById(registrationId);
    if (!student) {
      return res.status(404).json({ error: "Pendaftaran siswa tidak ditemukan." });
    }
    const user = req.user;
    const isSuper = user.role === "Super Admin Yayasan";
    const isWali = isWaliRoleName(user.role);
    if (isWali) {
      if (!studentBelongsToWali(student, user)) {
        return res.status(403).json({
          error: "Akses Ditolak: Anda hanya berhak mengunggah bukti pembayaran untuk putra/putri Anda sendiri."
        });
      }
    } else if (!isSuper) {
      const perms = user.permissions || [];
      const hasPayPerm = perms.includes("Pembayaran") || perms.includes("Pembayaran:add") || perms.includes("Pembayaran:edit") || perms.includes("Pembayaran:verify");
      if (!hasPayPerm) {
        return res.status(403).json({ error: "Akses Ditolak: Anda tidak memiliki izin mengelola pembayaran." });
      }
      if (user.schoolId && user.schoolId !== "MASTER" && student.unit !== user.schoolId) {
        return res.status(403).json({
          error: `Pelanggaran Batas Unit: Siswa terdaftar pada unit ${student.unit}, bukan unit ${user.schoolId}.`
        });
      }
    }
    const rawPaymentId = typeof req.body?.paymentId === "string" ? req.body.paymentId.trim().slice(0, 80) : "";
    const paymentId = rawPaymentId.length > 0 ? rawPaymentId : void 0;
    if (paymentId) {
      const existingPay = (await db.getPaymentsFresh()).find((p) => p.id === paymentId);
      if (!existingPay || existingPay.registrationId !== student.id) {
        return res.status(403).json({
          error: "Catatan pembayaran tujuan tidak ditemukan atau bukan milik siswa ini."
        });
      }
      if (isWali && existingPay.status === "lunas") {
        return res.status(400).json({
          error: "Bukti pembayaran ini sudah diverifikasi Lunas dan tidak dapat ditimpa. Silakan unggah sebagai bukti transfer baru."
        });
      }
    }
    const storedProofUrl = validatedDataCheck ? db.saveUploadedBufferToDisk(validatedDataCheck.buffer, "pay", validatedDataCheck.ext) : trimmedProof;
    const bankAccountId = typeof req.body?.bankAccountId === "string" ? req.body.bankAccountId.trim().slice(0, 80) : void 0;
    const savedPayment = await db.uploadPaymentProof(
      student.id,
      storedProofUrl,
      Math.round(numericAmount),
      type,
      bankAccountId,
      paymentId
    );
    if (!savedPayment) {
      if (validatedDataCheck) {
        db.deleteUploadFileIfUnused(storedProofUrl);
      }
      return res.status(404).json({ error: "Pendaftaran siswa atau catatan pembayaran tidak ditemukan." });
    }
    res.json({ message: "Bukti transfer berhasil diunggah.", payment: savedPayment });
  } catch (err) {
    console.error("[API Upload Proof Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan bukti pembayaran ke database." });
  }
});
app.post("/api/payments/verify-group", requireAuth, requirePermission("Pembayaran", "verify"), async (req, res) => {
  try {
    const { paymentIds, approved, notes } = req.body || {};
    if (!Array.isArray(paymentIds) || paymentIds.length === 0 || paymentIds.length > 50) {
      return res.status(400).json({ error: "Daftar ID pembayaran tidak valid (minimal 1, maksimal 50)." });
    }
    const cleanIds = Array.from(
      new Set(
        paymentIds.filter((id) => typeof id === "string" && id.trim().length > 0).map((id) => id.trim().slice(0, 80))
      )
    );
    if (cleanIds.length === 0) {
      return res.status(400).json({ error: "Daftar ID pembayaran kosong." });
    }
    const allPayments = await db.getPaymentsFresh();
    const user = req.user;
    const isMasterOrYys = user.schoolId === "MASTER" || user.role === "Super Admin Yayasan" || (user.role || "").toLowerCase().includes("admin yayasan");
    for (const pid of cleanIds) {
      const targetPay = allPayments.find((p) => p.id === pid);
      if (!targetPay) {
        return res.status(404).json({ error: `Catatan pembayaran "${pid}" tidak ditemukan.` });
      }
      if (!isMasterOrYys && user.schoolId && targetPay.unit !== user.schoolId) {
        return res.status(403).json({
          error: `Pelanggaran Batas Unit: Pembayaran ini milik unit ${targetPay.unit}, bukan unit ${user.schoolId}.`
        });
      }
    }
    const cleanNotes = typeof notes === "string" ? notes.trim().slice(0, 1e3) : void 0;
    const verifiedBy = req.user?.email || "bendahara@arrisalahaceh.or.id";
    const isApproved = Boolean(approved);
    const updatedList = await db.verifyPaymentGroup(cleanIds, isApproved, cleanNotes, verifiedBy);
    let emailNotification;
    if (!isApproved && updatedList.length > 0) {
      const groupedByStudent = /* @__PURE__ */ new Map();
      for (const item of updatedList) {
        const key = item.registrationId || item.registrationNumber || item.id;
        const arr = groupedByStudent.get(key) || [];
        arr.push(item);
        groupedByStudent.set(key, arr);
      }
      const mailResults = [];
      for (const groupItems of groupedByStudent.values()) {
        mailResults.push(await sendPaymentRejectionEmailToWali(groupItems, req));
      }
      const firstSuccess = mailResults.find((r) => r.sent);
      const firstWithMask = mailResults.find((r) => r.recipientMasked);
      emailNotification = {
        sent: mailResults.some((r) => r.sent),
        recipientMasked: firstSuccess?.recipientMasked || firstWithMask?.recipientMasked,
        error: mailResults.every((r) => r.sent) ? void 0 : mailResults.find((r) => !r.sent && r.error)?.error
      };
    }
    res.json({
      payments: updatedList.map(attachReceiptSig),
      ...emailNotification ? { emailNotification } : {}
    });
  } catch (err) {
    console.error("[API Verify Payment Group Error]:", err);
    res.status(500).json({ error: "Gagal memperbarui status verifikasi pembayaran di database." });
  }
});
app.post("/api/payments/:id/verify", requireAuth, requirePermission("Pembayaran", "verify"), async (req, res) => {
  try {
    const targetPay = (await db.getPaymentsFresh()).find((p) => p.id === req.params.id);
    if (!targetPay) {
      return res.status(404).json({ error: "Catatan pembayaran tidak ditemukan." });
    }
    const user = req.user;
    if (user.schoolId && user.schoolId !== "MASTER" && user.role !== "Super Admin Yayasan" && !(user.role || "").toLowerCase().includes("admin yayasan") && targetPay.unit !== user.schoolId) {
      return res.status(403).json({
        error: `Pelanggaran Batas Unit: Pembayaran ini milik unit ${targetPay.unit}, bukan unit ${user.schoolId}.`
      });
    }
    const { approved, notes, amount } = req.body || {};
    let adjustedAmount = void 0;
    if (amount !== void 0 && amount !== null && amount !== "") {
      const validRawType = typeof amount === "number" && Number.isFinite(amount) || typeof amount === "string" && /^\d+$/.test(amount.trim());
      const parsedAmount = validRawType ? Number(amount) : NaN;
      if (!Number.isFinite(parsedAmount) || parsedAmount < 1 || parsedAmount > 1e9) {
        return res.status(400).json({ error: "Nominal real harus berupa angka valid antara Rp 1 hingga Rp 1.000.000.000." });
      }
      adjustedAmount = Math.round(parsedAmount);
    }
    const cleanNotes = typeof notes === "string" ? notes.trim().slice(0, 1e3) : void 0;
    const verifiedBy = req.user?.email || "bendahara@arrisalahaceh.or.id";
    const isApproved = Boolean(approved);
    const updated = await db.verifyPayment(req.params.id, isApproved, cleanNotes, verifiedBy, adjustedAmount);
    if (!updated) {
      return res.status(404).json({ error: "Catatan pembayaran tidak ditemukan." });
    }
    const emailNotification = !isApproved ? await sendPaymentRejectionEmailToWali([updated], req) : void 0;
    res.json({
      ...attachReceiptSig(updated),
      ...emailNotification ? { emailNotification } : {}
    });
  } catch (err) {
    console.error("[API Verify Payment Error]:", err);
    res.status(500).json({ error: "Gagal memperbarui status verifikasi pembayaran di database." });
  }
});
app.patch("/api/payments/:id/amount", requireAuth, requirePermission("Pembayaran", "verify"), async (req, res) => {
  try {
    const targetPay = (await db.getPaymentsFresh()).find((p) => p.id === req.params.id);
    if (!targetPay) {
      return res.status(404).json({ error: "Catatan pembayaran tidak ditemukan." });
    }
    const user = req.user;
    if (user.schoolId && user.schoolId !== "MASTER" && user.role !== "Super Admin Yayasan" && !(user.role || "").toLowerCase().includes("admin yayasan") && targetPay.unit !== user.schoolId) {
      return res.status(403).json({
        error: `Pelanggaran Batas Unit: Pembayaran ini milik unit ${targetPay.unit}, bukan unit ${user.schoolId}.`
      });
    }
    const rawAmount = req.body?.amount;
    const validRawType = typeof rawAmount === "number" && Number.isFinite(rawAmount) || typeof rawAmount === "string" && /^\d+$/.test(rawAmount.trim());
    const parsedAmount = validRawType ? Number(rawAmount) : NaN;
    if (!Number.isFinite(parsedAmount) || parsedAmount < 1 || parsedAmount > 1e9) {
      return res.status(400).json({ error: "Nominal real harus berupa angka valid antara Rp 1 hingga Rp 1.000.000.000." });
    }
    const updatedBy = req.user?.email || "bendahara@arrisalahaceh.or.id";
    const updated = await db.updatePaymentAmount(req.params.id, Math.round(parsedAmount), updatedBy);
    if (!updated) {
      return res.status(404).json({ error: "Catatan pembayaran tidak ditemukan." });
    }
    res.json(attachReceiptSig(updated));
  } catch (err) {
    console.error("[API Update Payment Amount Error]:", err);
    res.status(500).json({ error: "Gagal memperbarui nominal pembayaran di database." });
  }
});
app.get("/api/schedules", (req, res) => {
  const list = db.getSchedules(req.query.unit);
  res.json(list);
});
app.post("/api/schedules", requireAuth, requirePermission("Jadwal", "add"), requireUnitIsolation, async (req, res) => {
  try {
    const { title, unit, date, startTime, endTime, room, examiner, quota } = req.body;
    if (!title || !room || !examiner) {
      return res.status(400).json({ error: "Judul, ruangan, dan nama penguji wajib diisi." });
    }
    const newSch = await db.createSchedule({
      title,
      unit: unit || "SD01",
      date: date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      startTime: startTime || "08:00",
      endTime: endTime || "12:00",
      room,
      examiner,
      quota: Number(quota) || 40
    });
    res.status(201).json(newSch);
  } catch (err) {
    console.error("[API Create Schedule Error]:", err);
    res.status(500).json({ error: "Gagal menambahkan jadwal tes ke database." });
  }
});
app.put("/api/schedules/:id", requireAuth, requirePermission("Jadwal", "edit"), requireUnitIsolation, async (req, res) => {
  try {
    const { title, unit, date, startTime, endTime, room, examiner, quota } = req.body || {};
    const updates = {};
    if (typeof title === "string" && title.trim()) updates.title = title.trim().slice(0, 150);
    if (typeof unit === "string" && unit.trim()) updates.unit = unit.trim().toUpperCase();
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) updates.date = date.trim();
    if (typeof startTime === "string" && startTime.trim()) updates.startTime = startTime.trim().slice(0, 10);
    if (typeof endTime === "string" && endTime.trim()) updates.endTime = endTime.trim().slice(0, 10);
    if (typeof room === "string" && room.trim()) updates.room = room.trim().slice(0, 100);
    if (typeof examiner === "string" && examiner.trim()) updates.examiner = examiner.trim().slice(0, 150);
    if (quota !== void 0) {
      const q = Number(quota);
      if (!Number.isFinite(q) || q < 1 || q > 5e3) {
        return res.status(400).json({ error: "Kuota jadwal tes harus antara 1 sampai 5.000." });
      }
      updates.quota = Math.floor(q);
    }
    const updated = await db.updateSchedule(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ error: "Jadwal tes tidak ditemukan." });
    }
    res.json(updated);
  } catch (err) {
    console.error("[API Update Schedule Error]:", err);
    res.status(500).json({ error: "Gagal memperbarui jadwal tes di database." });
  }
});
app.delete("/api/schedules/:id", requireAuth, requirePermission("Jadwal", "delete"), requireUnitIsolation, async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.name || "Admin";
    const actorRole = req.user?.role || "Staff";
    const success = await db.deleteSchedule(req.params.id, actor, actorRole);
    if (!success) {
      return res.status(404).json({ error: "Jadwal tes tidak ditemukan." });
    }
    res.json({ message: "Jadwal berhasil dihapus dan diarsipkan ke Sampah Master." });
  } catch (err) {
    console.error("[API Delete Schedule Error]:", err);
    res.status(500).json({ error: "Gagal menghapus jadwal tes dari database." });
  }
});
app.get("/api/units", (req, res) => {
  res.json(db.getUnits());
});
app.post("/api/units", requireAuth, requireMaster, requirePermission("Kuota & Biaya", "edit"), async (req, res) => {
  try {
    const { id, name, shortName, totalQuota, offlineCount, formFee, reRegFee, isOpen, closedNotice, facilities } = req.body || {};
    const cleanId = typeof id === "string" ? id.trim().toUpperCase() : "";
    if (!cleanId || !/^[A-Z0-9]{2,10}$/.test(cleanId)) {
      return res.status(400).json({ error: "Kode Unit wajib 2-10 karakter huruf kapital/angka tanpa spasi (contoh: KB01, MA01)." });
    }
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 120) {
      return res.status(400).json({ error: "Nama resmi unit sekolah wajib diisi (2-120 karakter)." });
    }
    if (!shortName || typeof shortName !== "string" || shortName.trim().length < 2 || shortName.length > 20) {
      return res.status(400).json({ error: "Singkatan jenjang wajib diisi (2-20 karakter, contoh: KBIT, MAIT)." });
    }
    const q = Number(totalQuota);
    if (!Number.isFinite(q) || q < 1 || q > 1e4) {
      return res.status(400).json({ error: "Total kuota daya tampung harus antara 1 sampai 10.000." });
    }
    const off = offlineCount !== void 0 ? Number(offlineCount) : 0;
    if (!Number.isFinite(off) || off < 0 || off > 1e4) {
      return res.status(400).json({ error: "Jumlah pendaftar offline awal tidak valid." });
    }
    if (db.getUnits().some((u) => u.id.toUpperCase() === cleanId)) {
      return res.status(409).json({ error: `Kode unit "${cleanId}" sudah terdaftar di sistem.` });
    }
    const sanitizedFacilities = Array.isArray(facilities) ? facilities.filter((f) => typeof f === "string" && f.trim().length > 0).map((f) => f.trim().slice(0, 120)).slice(0, 12) : [];
    const actor = req.user?.email || req.user?.name || "Master Admin";
    const created = await db.createUnit(
      {
        id: cleanId,
        name: name.trim(),
        shortName: shortName.trim(),
        totalQuota: Math.floor(q),
        offlineCount: Math.floor(off),
        formFee: Math.max(0, Number(formFee) || 0),
        reRegFee: Math.max(0, Number(reRegFee) || 0),
        isOpen: isOpen !== void 0 ? Boolean(isOpen) : true,
        closedNotice: typeof closedNotice === "string" ? closedNotice.trim().slice(0, 500) : void 0,
        facilities: sanitizedFacilities
      },
      actor
    );
    if (!created) {
      return res.status(409).json({ error: `Gagal membuat unit "${cleanId}" (kemungkinan kode sudah ada).` });
    }
    res.status(201).json(created);
  } catch (err) {
    console.error("[API Create Unit Error]:", err);
    res.status(500).json({ error: "Gagal menambahkan unit sekolah baru ke database." });
  }
});
app.put("/api/units/:id/offline-count", requireAuth, requirePermission("Kuota & Biaya", "edit"), requireUnitIsolation, async (req, res) => {
  try {
    const targetUnit = String(req.params.id || "").trim().toUpperCase();
    const existing = db.getUnits().find((u) => u.id === targetUnit);
    if (!existing) {
      return res.status(404).json({ error: "Unit sekolah tidak ditemukan." });
    }
    const rawCount = req.body?.offlineCount;
    const numericCount = Number(rawCount);
    if (rawCount === void 0 || rawCount === null || !Number.isFinite(numericCount) || numericCount < 0 || numericCount > 1e5) {
      return res.status(400).json({ error: "Jumlah pendaftar offline harus berupa angka bulat >= 0." });
    }
    const actor = req.user?.email || req.user?.name || "Admin";
    const updated = await db.updateUnitOfflineCount(targetUnit, Math.floor(numericCount), actor);
    if (!updated) {
      return res.status(404).json({ error: "Unit sekolah tidak ditemukan." });
    }
    res.json(updated);
  } catch (err) {
    console.error("[API Update Offline Count Error]:", err);
    res.status(500).json({ error: "Gagal memperbarui angka pendaftar offline ke database." });
  }
});
app.put("/api/units/reorder", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (isWaliRoleName(user.role)) {
      return res.status(403).json({
        error: "Akses Ditolak: Wali siswa tidak berhak mengubah urutan unit sekolah."
      });
    }
    const roleLower = (user.role || "").toLowerCase();
    const isMasterOrYayasanAdmin = user.role === "Super Admin Yayasan" || roleLower.includes("super admin") || roleLower.includes("admin yayasan");
    if (!isMasterOrYayasanAdmin) {
      addAuditLog(
        "unauthorized_access",
        user.schoolId || "MASTER",
        `Akses ditolak: ${user.email} (${user.role}) mencoba mengurutkan ulang unit sekolah`,
        user.email,
        req.ip || "127.0.0.1"
      );
      return res.status(403).json({
        error: "Akses Ditolak (403 Forbidden): Hanya Admin Yayasan dan Master Admin yang dapat mengubah urutan unit sekolah."
      });
    }
    const rawOrderedIds = req.body?.orderedIds;
    const currentUnitIds = db.getUnits().map((u) => u.id);
    if (!Array.isArray(rawOrderedIds) || rawOrderedIds.length !== currentUnitIds.length || !rawOrderedIds.every((id) => typeof id === "string")) {
      return res.status(400).json({
        error: `Daftar orderedIds tidak valid. Harus berupa array berisi seluruh ${currentUnitIds.length} unit sekolah.`
      });
    }
    const normalizedIds = rawOrderedIds.map((id) => id.trim().toUpperCase());
    if (new Set(normalizedIds).size !== currentUnitIds.length || !currentUnitIds.every((u) => normalizedIds.includes(u))) {
      return res.status(400).json({
        error: `Daftar orderedIds harus memuat setiap unit (${currentUnitIds.join(", ")}) tepat satu kali.`
      });
    }
    const actor = user.email || user.name || "Admin";
    const updatedUnits = await db.reorderUnits(normalizedIds, actor);
    if (!updatedUnits) {
      return res.status(400).json({ error: "Gagal memvalidasi urutan unit sekolah." });
    }
    res.json(updatedUnits);
  } catch (err) {
    console.error("[API Reorder Units Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan urutan unit sekolah ke database." });
  }
});
app.put("/api/units/:id", requireAuth, requireMaster, requirePermission("Kuota & Biaya", "edit"), async (req, res) => {
  try {
    const { quota, formFee, reRegFee, isOpen, closedNotice, offlineCount } = req.body;
    const updated = await db.updateUnit(
      String(req.params.id || "").trim().toUpperCase(),
      Number(quota) || 100,
      Number(formFee) || 0,
      Number(reRegFee) || 0,
      isOpen !== void 0 ? Boolean(isOpen) : true,
      closedNotice,
      offlineCount !== void 0 ? Number(offlineCount) : void 0
    );
    if (!updated) {
      return res.status(404).json({ error: "Unit sekolah tidak ditemukan." });
    }
    res.json(updated);
  } catch (err) {
    console.error("[API Update Unit Error]:", err);
    res.status(500).json({ error: "Gagal memperbarui konfigurasi unit sekolah di database." });
  }
});
app.put("/api/units/:id/status", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (isWaliRoleName(user.role)) {
      return res.status(403).json({
        error: "Akses Ditolak: Wali siswa tidak berhak mengubah status pendaftaran unit."
      });
    }
    const targetUnit = String(req.params.id || "").trim().toUpperCase();
    const validUnitIds = db.getUnits().map((u) => u.id);
    if (!validUnitIds.includes(targetUnit)) {
      return res.status(400).json({ error: "Unit sekolah tidak valid." });
    }
    const roleLower = (user.role || "").toLowerCase();
    const isSuperOrYys = user.role === "Super Admin Yayasan" || roleLower.includes("admin yayasan") || roleLower.includes("super admin");
    const isAdminUnit = roleLower.includes("admin unit");
    const perms = user.permissions || [];
    const hasQuotaEdit = perms.includes("Kuota & Biaya") || perms.includes("Kuota & Biaya:edit");
    if (!isSuperOrYys && !isAdminUnit && !hasQuotaEdit) {
      addAuditLog(
        "unauthorized_access",
        user.schoolId || "MASTER",
        `Akses ditolak: ${user.email} (${user.role}) mencoba mengubah aktivasi pendaftaran unit ${targetUnit}`,
        user.email,
        req.ip || "127.0.0.1"
      );
      return res.status(403).json({
        error: "Akses Ditolak: Hanya Admin Unit, Admin Yayasan, atau Master Admin yang dapat mengaktifkan pendaftaran."
      });
    }
    if (!isSuperOrYys && user.schoolId && user.schoolId !== "MASTER" && targetUnit !== user.schoolId) {
      addAuditLog(
        "unauthorized_access",
        user.schoolId,
        `Pelanggaran Isolasi Unit (BOLA): ${user.email} (${user.schoolId}) mencoba mengubah status pendaftaran unit ${targetUnit}`,
        user.email,
        req.ip || "127.0.0.1"
      );
      return res.status(403).json({
        error: `Pelanggaran Batas Unit: Anda (${user.schoolId}) hanya dapat mengaktifkan/menonaktifkan pendaftaran untuk unit ${user.schoolId}.`
      });
    }
    if (typeof req.body?.isOpen !== "boolean") {
      return res.status(400).json({ error: "Field status aktivasi (isOpen: boolean) wajib dikirim." });
    }
    const rawNotice = typeof req.body.closedNotice === "string" ? req.body.closedNotice.trim().slice(0, 500) : void 0;
    const actor = user.email || user.name || "Admin";
    const updated = await db.updateUnitRegistrationStatus(
      targetUnit,
      req.body.isOpen,
      rawNotice,
      actor
    );
    if (!updated) {
      return res.status(404).json({ error: "Unit sekolah tidak ditemukan." });
    }
    res.json(updated);
  } catch (err) {
    console.error("[API Update Unit Status Error]:", err);
    res.status(500).json({ error: "Gagal memperbarui status aktivasi pendaftaran unit." });
  }
});
app.delete("/api/units/:id", requireAuth, requireRole(["Super Admin Yayasan"]), async (req, res) => {
  try {
    const cleanId = String(req.params.id || "").trim().toUpperCase();
    const actor = req.user?.email || req.user?.name || "Super Admin";
    const result = await db.deleteUnit(cleanId, actor);
    if (!result.deleted) {
      if (result.reason === "not_found") {
        return res.status(404).json({ error: "Unit sekolah tidak ditemukan." });
      }
      return res.status(409).json({
        error: `Unit ${cleanId} tidak dapat dihapus karena masih memiliki data calon siswa terdaftar.`
      });
    }
    res.json({ success: true, deletedId: cleanId });
  } catch (err) {
    console.error("[API Delete Unit Error]:", err);
    res.status(500).json({ error: "Gagal menghapus unit sekolah dari database." });
  }
});
app.post("/api/upload-asset", requireAuth, requireMaster, uploadRateLimiter, async (req, res) => {
  try {
    const { filename, fileData, data, assetType } = req.body || {};
    const rawData = fileData || data;
    if (!filename || !rawData || typeof rawData !== "string") {
      return res.status(400).json({ error: "Filename dan fileData (Base64) wajib dikirim." });
    }
    const ALLOWED_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".ico"];
    const rawExt = path2.extname(String(filename)).toLowerCase();
    const defaultExt = assetType === "favicon" ? ".ico" : ".png";
    const ext = rawExt && rawExt.length > 1 ? rawExt : defaultExt;
    if (!ALLOWED_EXTS.includes(ext)) {
      return res.status(400).json({ error: "Ekstensi aset tidak diizinkan (hanya PNG, JPG, WebP, atau ICO)." });
    }
    let buffer;
    if (rawData.startsWith("data:")) {
      const check = verifyDataUriPayload(rawData, { allowPdf: false, allowIco: true });
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      buffer = check.buffer;
    } else {
      buffer = Buffer.from(rawData, "base64");
      if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Ukuran aset maksimal 5MB." });
      }
      const expectedKind = ext.replace(".", "");
      const magicOk = expectedKind === "ico" ? verifyBufferMagicBytes(buffer, "ico") || verifyBufferMagicBytes(buffer, "png") : verifyBufferMagicBytes(buffer, expectedKind);
      if (!magicOk) {
        return res.status(400).json({ error: "Signature biner (magic bytes) aset tidak cocok dengan ekstensi file." });
      }
    }
    const baseClean = path2.basename(String(filename), rawExt).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    const timestamp = Date.now();
    const safeName = `${timestamp}_${baseClean}${ext}`;
    const targetPath = path2.join(uploadsDir, safeName);
    fs2.writeFileSync(targetPath, buffer);
    const dataTargetPath = path2.join(dataUploadsDir, safeName);
    try {
      fs2.writeFileSync(dataTargetPath, buffer);
    } catch (e) {
    }
    if (assetType === "logo") {
      try {
        fs2.copyFileSync(targetPath, path2.join(uploadsDir, "logo.png"));
        fs2.copyFileSync(targetPath, path2.join(dataUploadsDir, "logo.png"));
      } catch (e) {
      }
    } else if (assetType === "favicon") {
      try {
        fs2.copyFileSync(targetPath, path2.join(uploadsDir, "favicon.ico"));
        fs2.copyFileSync(targetPath, path2.join(dataUploadsDir, "favicon.ico"));
      } catch (e) {
      }
    }
    const assetUrl = `/uploads/${safeName}`;
    if (assetType === "logo") {
      const current = db.getLandingConfig();
      await db.updateLandingConfig(
        {
          ...current,
          logoUrl: assetUrl,
          customLogoBase64: rawData
        },
        req.user?.email || "Master Admin",
        req.user?.role || "Super Admin Yayasan",
        true
      );
    } else if (assetType === "favicon") {
      const current = db.getLandingConfig();
      await db.updateLandingConfig(
        {
          ...current,
          faviconUrl: assetUrl,
          customFaviconBase64: rawData
        },
        req.user?.email || "Master Admin",
        req.user?.role || "Super Admin Yayasan",
        true
      );
    }
    addAuditLog(
      "update_status",
      "MASTER",
      `Upload aset web ${safeName} (${assetType || "asset"}) oleh ${req.user?.email}`,
      req.user?.email || "admin",
      req.ip || "127.0.0.1"
    );
    res.json({ success: true, url: assetUrl, filename: safeName, assetType });
  } catch (err) {
    console.error("[Upload Asset Error]:", err);
    res.status(500).json({ error: "Gagal mengunggah file aset ke database." });
  }
});
app.get("/api/form-schemas", optionalAuth, (req, res) => {
  const allSchemas = db.getFormSchemas();
  res.json(allSchemas);
});
app.put("/api/form-schemas/:unitId", requireAuth, requirePermission("Form Builder", "edit"), requireUnitIsolation, async (req, res) => {
  const targetUnit = String(req.params.unitId || "").trim().toUpperCase();
  const VALID_UNITS = db.getUnits().map((u) => u.id);
  if (!VALID_UNITS.includes(targetUnit)) {
    return res.status(400).json({ error: "Unit sekolah tidak valid." });
  }
  if (req.user && req.user.schoolId !== "MASTER" && req.user.role !== "Super Admin Yayasan") {
    if (targetUnit !== req.user.schoolId) {
      addAuditLog(
        "unauthorized_access",
        req.user.schoolId,
        `Pelanggaran Isolasi Unit: ${req.user.email} (${req.user.schoolId}) mencoba mengubah formulir unit ${targetUnit}`,
        req.user.email,
        req.ip || "127.0.0.1"
      );
      return res.status(403).json({
        error: `Pelanggaran Batas Unit (BOLA): Anda (${req.user.schoolId}) tidak memiliki izin mengubah formulir unit ${targetUnit}. Setiap unit sekolah berdiri sendiri.`
      });
    }
  }
  if (req.body && req.body.unitId && req.body.unitId !== targetUnit) {
    return res.status(400).json({ error: "Data unitId payload tidak sesuai dengan target URL." });
  }
  if (!req.body || !Array.isArray(req.body.sections)) {
    return res.status(400).json({ error: "Payload formulir harus memiliki array sections yang valid." });
  }
  const ALLOWED_FIELD_TYPES = ["text", "number", "date", "dropdown", "file", "textarea"];
  const sanitizedSections = [];
  for (const sec of req.body.sections) {
    if (!sec || typeof sec !== "object" || typeof sec.id !== "string" || !sec.id.trim()) {
      return res.status(400).json({ error: "Setiap seksi formulir wajib memiliki ID yang valid." });
    }
    if (typeof sec.title !== "string" || sec.title.trim().length === 0 || sec.title.length > 200) {
      return res.status(400).json({ error: "Judul seksi wajib diisi (maksimal 200 karakter)." });
    }
    if (!Array.isArray(sec.fields)) {
      return res.status(400).json({ error: `Daftar field pada seksi "${sec.title}" tidak valid.` });
    }
    const sanitizedFields = [];
    for (const f of sec.fields) {
      if (!f || typeof f !== "object" || typeof f.id !== "string" || !f.id.trim()) {
        return res.status(400).json({ error: "Setiap field wajib memiliki ID yang valid." });
      }
      if (typeof f.label !== "string" || f.label.trim().length === 0 || f.label.length > 200) {
        return res.status(400).json({ error: "Label pertanyaan wajib diisi (maksimal 200 karakter)." });
      }
      if (!ALLOWED_FIELD_TYPES.includes(f.type)) {
        return res.status(400).json({ error: `Tipe field "${f.type}" tidak didukung.` });
      }
      const isCoreName = isLockedNameField(f);
      sanitizedFields.push({
        id: f.id.trim(),
        label: f.label.trim(),
        type: isCoreName ? "text" : f.type,
        required: isCoreName ? true : Boolean(f.required),
        helpText: typeof f.helpText === "string" ? f.helpText.slice(0, 500) : "",
        options: !isCoreName && Array.isArray(f.options) ? f.options.map((o) => String(o).slice(0, 200)) : void 0,
        fileConfig: !isCoreName && f.fileConfig && typeof f.fileConfig === "object" ? {
          allowedTypes: Array.isArray(f.fileConfig.allowedTypes) ? f.fileConfig.allowedTypes.map((t) => String(t).slice(0, 20)) : ["PDF", "JPG", "PNG"],
          maxSizeMB: Math.min(20, Math.max(1, Number(f.fileConfig.maxSizeMB) || 5))
        } : void 0,
        ...isCoreName ? { systemKey: "fullName", locked: true } : {}
      });
    }
    sanitizedSections.push({
      id: sec.id.trim(),
      title: sec.title.trim(),
      description: typeof sec.description === "string" ? sec.description.trim().slice(0, 500) : void 0,
      fields: sanitizedFields
    });
  }
  const existingSchemas = db.getFormSchemas();
  const existingUnitSchema = existingSchemas.find((s) => s.unitId === targetUnit);
  const existingHasLockedName = existingUnitSchema?.sections?.some(
    (s) => (s.fields || []).some((f) => isLockedNameField(f))
  );
  const incomingHasLockedName = sanitizedSections.some(
    (s) => (s.fields || []).some((f) => isLockedNameField(f))
  );
  if (existingHasLockedName && !incomingHasLockedName) {
    return res.status(400).json({
      error: "Field Nama pada Section 1 bersifat wajib sistem (labelnya dapat diedit, tetapi field tidak dapat dihapus)."
    });
  }
  const normalizedSections = ensureCoreNameFieldInSections(sanitizedSections, targetUnit);
  if (existingUnitSchema && Array.isArray(existingUnitSchema.sections)) {
    const incomingIds = new Set(normalizedSections.map((s) => s.id));
    const removedSavedSections = existingUnitSchema.sections.filter((s) => !incomingIds.has(s.id));
    if (removedSavedSections.length > 0) {
      const isMasterOrYayasan = req.user?.role === "Super Admin Yayasan" || req.user?.role === "Admin Yayasan" || (req.user?.role || "").toLowerCase().includes("yayasan") || req.user?.schoolId === "MASTER";
      if (!isMasterOrYayasan) {
        addAuditLog(
          "unauthorized_access",
          req.user?.schoolId || targetUnit,
          `Akses Ditolak: ${req.user?.email} mencoba menghapus seksi tersimpan (${removedSavedSections.map((s) => s.title).join(", ")}) pada unit ${targetUnit}`,
          req.user?.email || "unknown",
          req.ip || "127.0.0.1"
        );
        return res.status(403).json({
          error: "Akses Ditolak: Seksi formulir yang sudah tersimpan tidak dapat dihapus oleh Admin Unit. Hanya Admin Yayasan atau Master Admin yang berwenang menghapus seksi tersimpan."
        });
      }
    }
  }
  try {
    const actor = req.user?.email || req.user?.name || "Admin";
    const actorRole = req.user?.role || "Staff";
    const updated = await db.updateFormSchema(
      targetUnit,
      {
        unitId: targetUnit,
        sections: normalizedSections
      },
      actor,
      actorRole
    );
    addAuditLog(
      "update_status",
      targetUnit,
      `Form builder unit ${targetUnit} berhasil diperbarui (${sanitizedSections.length} seksi) oleh ${req.user?.email || "admin"}`,
      req.user?.email || "admin@arrisalahaceh.or.id",
      req.ip || "127.0.0.1"
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message || "Gagal menyimpan skema formulir ke database." });
  }
});
app.get("/api/roles", optionalAuth, (req, res) => {
  res.json(db.getRoles());
});
app.post("/api/roles", requireAuth, requireRole(["Super Admin Yayasan"]), async (req, res) => {
  try {
    const { name, schoolId, permissions, description } = req.body || {};
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 100) {
      return res.status(400).json({ error: "Nama role wajib 2-100 karakter." });
    }
    const cleanSchool = typeof schoolId === "string" && schoolId.trim() ? schoolId.trim().toUpperCase() : "MASTER";
    const validUnits = ["MASTER", ...db.getUnits().map((u) => u.id)];
    if (!validUnits.includes(cleanSchool)) {
      return res.status(400).json({ error: "Lingkup unit sekolah role tidak valid." });
    }
    const cleanPermissions = Array.isArray(permissions) ? Array.from(new Set(permissions.map((p) => String(p).trim()).filter((p) => ALL_VALID_PERMISSIONS.has(p)))) : [];
    const newRole = await db.createRole({
      name: name.trim(),
      schoolId: cleanSchool,
      permissions: cleanPermissions,
      description: typeof description === "string" ? description.trim().slice(0, 500) : ""
    });
    res.status(201).json(newRole);
  } catch (err) {
    console.error("[API Create Role Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan role baru ke database." });
  }
});
app.put("/api/roles/:id", requireAuth, requireRole(["Super Admin Yayasan"]), async (req, res) => {
  try {
    const { name, schoolId, permissions, description } = req.body || {};
    const updates = {};
    if (name !== void 0) {
      if (typeof name !== "string" || name.trim().length < 2 || name.length > 100) {
        return res.status(400).json({ error: "Nama role wajib 2-100 karakter." });
      }
      updates.name = name.trim();
    }
    if (schoolId !== void 0) {
      const cleanSchool = String(schoolId).trim().toUpperCase();
      const validUnits = ["MASTER", ...db.getUnits().map((u) => u.id)];
      if (!validUnits.includes(cleanSchool)) {
        return res.status(400).json({ error: "Lingkup unit sekolah role tidak valid." });
      }
      updates.schoolId = cleanSchool;
    }
    if (permissions !== void 0) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: "Daftar permissions role harus berupa array." });
      }
      updates.permissions = Array.from(
        new Set(permissions.map((p) => String(p).trim()).filter((p) => ALL_VALID_PERMISSIONS.has(p)))
      );
    }
    if (description !== void 0) {
      updates.description = typeof description === "string" ? description.trim().slice(0, 500) : "";
    }
    const updated = await db.updateRole(req.params.id, updates);
    res.json(updated);
  } catch (err) {
    console.error("[API Update Role Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan pembaruan role ke database." });
  }
});
app.delete("/api/roles/:id", requireAuth, requireRole(["Super Admin Yayasan"]), async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.name || "Master Admin";
    const actorRole = req.user?.role || "Super Admin Yayasan";
    const success = await db.deleteRole(req.params.id, actor, actorRole);
    if (!success) {
      return res.status(404).json({ error: "Role tidak ditemukan." });
    }
    res.json({ success });
  } catch (err) {
    console.error("[API Delete Role Error]:", err);
    res.status(500).json({ error: "Gagal menghapus role dari database." });
  }
});
app.get("/api/users", requireAuth, (req, res) => {
  const user = req.user;
  const isSuper = user.role === "Super Admin Yayasan" || user.email === "master@dev.com";
  const isYys = user.role === "Admin Yayasan" || user.email === "adminyys@dev.com" || user.role?.includes("Admin Yayasan");
  const hasPerm = user.permissions?.includes("Kelola Users") || user.permissions?.some((p) => p.startsWith("Kelola Users"));
  if (!isSuper && !isYys && !hasPerm) {
    const self = db.getUsers().find((u) => u.id === user.id) || user;
    return res.json([self]);
  }
  let users = db.getUsers(user);
  if (!isSuper && !isYys && user.schoolId && user.schoolId !== "MASTER") {
    users = users.filter((u) => u.schoolId === user.schoolId || u.id === user.id);
  }
  res.json(users);
});
app.post("/api/users", requireAuth, async (req, res) => {
  try {
    const isSuper = req.user?.role === "Super Admin Yayasan" || req.user?.email === "master@dev.com";
    const isYys = req.user?.role === "Admin Yayasan" || req.user?.email === "adminyys@dev.com" || req.user?.role?.includes("Admin Yayasan");
    const hasPerm = req.user?.permissions?.includes("Kelola Users") || req.user?.permissions?.includes("Kelola Users:add");
    if (!isSuper && !isYys && !hasPerm) {
      return res.status(403).json({ error: "Akses Ditolak: Anda tidak memiliki izin menambah staf." });
    }
    const { name, email, phone, schoolId, role, permissions, isActive, password } = req.body || {};
    if (!name || typeof name !== "string" || !email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Nama lengkap dan alamat email valid wajib diisi." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const targetSchoolId = typeof schoolId === "string" && schoolId.trim() ? schoolId.trim().toUpperCase() : "MASTER";
    if (!isSuper) {
      const requestedRole = String(role || "");
      if (requestedRole.includes("Super Admin") || requestedRole.includes("Admin Yayasan") || cleanEmail === "master@dev.com" || cleanEmail === "adminyys@dev.com") {
        return res.status(403).json({
          error: "Akses Ditolak: Anda tidak memiliki wewenang untuk membuat akun staf tingkat Master atau Admin Yayasan."
        });
      }
      if (!isYys && req.user?.schoolId && req.user.schoolId !== "MASTER") {
        if (targetSchoolId !== req.user.schoolId) {
          return res.status(403).json({
            error: `Pelanggaran Batas Unit: Anda hanya berhak menambah staf untuk unit ${req.user.schoolId}.`
          });
        }
      }
      if (Array.isArray(permissions)) {
        const triesSuperPerm = permissions.some(
          (p) => SUPER_ADMIN_ONLY_MODULES.has(String(p).split(":")[0].trim())
        );
        if (triesSuperPerm) {
          return res.status(403).json({
            error: "Akses Ditolak: Hak akses modul khusus Master Admin tidak dapat diberikan."
          });
        }
      }
    }
    if (db.getUsers().some((u) => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: `Alamat email "${cleanEmail}" sudah terdaftar di sistem.` });
    }
    if (password !== void 0 && (typeof password !== "string" || password.length < 6)) {
      return res.status(400).json({ error: "Kata sandi minimal 6 karakter." });
    }
    const cleanPerms = Array.isArray(permissions) ? Array.from(new Set(permissions.map((p) => String(p).trim()).filter((p) => ALL_VALID_PERMISSIONS.has(p)))) : [];
    const newUser = await db.createUser({
      name: name.trim().slice(0, 150),
      email: cleanEmail,
      phone: typeof phone === "string" ? phone.trim().slice(0, 30) : "",
      schoolId: targetSchoolId,
      role: typeof role === "string" && role.trim() ? role.trim() : "Staf Verifikator Berkas",
      permissions: cleanPerms,
      isActive: isActive !== void 0 ? Boolean(isActive) : true,
      emailVerified: true,
      password
    });
    res.status(201).json(newUser);
  } catch (err) {
    console.error("[API Create User Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan akun pengguna ke database." });
  }
});
app.put("/api/users/:id", requireAuth, async (req, res) => {
  try {
    const isSelf = req.user?.id === req.params.id;
    const isSuper = req.user?.role === "Super Admin Yayasan" || req.user?.email === "master@dev.com";
    const isYys = req.user?.role === "Admin Yayasan" || req.user?.email === "adminyys@dev.com" || req.user?.role?.includes("Admin Yayasan");
    const hasPerm = req.user?.permissions?.includes("Kelola Users") || req.user?.permissions?.includes("Kelola Users:edit");
    if (!isSelf && !isSuper && !isYys && !hasPerm) {
      return res.status(403).json({ error: "Akses Ditolak: Anda tidak memiliki izin mengubah data akun pengguna." });
    }
    const target = db.getUsers().find((u) => u.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    }
    let sanitizedUpdates = {};
    if (isSelf && !isSuper) {
      const { name, phone, password } = req.body || {};
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Nama lengkap wajib diisi." });
      }
      sanitizedUpdates = {
        name: name.trim().slice(0, 150),
        phone: phone ? String(phone).trim().slice(0, 30) : ""
      };
      if (password && typeof password === "string" && password.length >= 6) {
        sanitizedUpdates.password = password;
      }
    } else {
      if (!isSuper) {
        const isTargetMaster = target.role === "Super Admin Yayasan" || target.email === "master@dev.com" || target.role?.includes("Super Admin");
        const isTargetYys = target.role === "Admin Yayasan" || target.email === "adminyys@dev.com" || target.role?.includes("Admin Yayasan") && !target.role?.includes("Super");
        if (isTargetMaster || isTargetYys) {
          return res.status(403).json({
            error: "Akses Ditolak: Akun Master dan Admin Yayasan dilindungi sistem dan tidak dapat diubah."
          });
        }
        if (!isYys && req.user?.schoolId && req.user.schoolId !== "MASTER" && target.schoolId !== req.user.schoolId) {
          return res.status(403).json({
            error: `Pelanggaran Batas Unit: Anda hanya berhak mengelola akun unit ${req.user.schoolId}.`
          });
        }
        const requestedRole = String(req.body?.role || "");
        if (requestedRole.includes("Super Admin") || requestedRole.includes("Admin Yayasan")) {
          return res.status(403).json({
            error: "Akses Ditolak: Anda tidak memiliki wewenang menaikkan hak staf ke tingkat Master atau Admin Yayasan."
          });
        }
        if (req.body?.schoolId !== void 0 && !isYys && req.user?.schoolId && req.user.schoolId !== "MASTER") {
          const reqSchool = String(req.body.schoolId).trim().toUpperCase();
          if (reqSchool !== req.user.schoolId) {
            return res.status(403).json({
              error: `Pelanggaran Batas Unit: Tidak dapat memindahkan akun ke unit ${reqSchool}.`
            });
          }
        }
        if (Array.isArray(req.body?.permissions)) {
          const triesSuperPerm = req.body.permissions.some(
            (p) => SUPER_ADMIN_ONLY_MODULES.has(String(p).split(":")[0].trim())
          );
          if (triesSuperPerm) {
            return res.status(403).json({
              error: "Akses Ditolak: Hak akses modul khusus Master Admin tidak dapat diberikan."
            });
          }
        }
      }
      const { name, email, phone, schoolId, role, permissions, isActive, emailVerified, password } = req.body || {};
      if (name !== void 0) {
        if (typeof name !== "string" || !name.trim()) {
          return res.status(400).json({ error: "Nama lengkap tidak valid." });
        }
        sanitizedUpdates.name = name.trim().slice(0, 150);
      }
      if (email !== void 0) {
        if (typeof email !== "string" || !email.includes("@")) {
          return res.status(400).json({ error: "Alamat email tidak valid." });
        }
        sanitizedUpdates.email = email.trim().toLowerCase();
      }
      if (phone !== void 0) sanitizedUpdates.phone = String(phone).trim().slice(0, 30);
      if (schoolId !== void 0) sanitizedUpdates.schoolId = String(schoolId).trim().toUpperCase();
      if (role !== void 0 && typeof role === "string" && role.trim()) sanitizedUpdates.role = role.trim().slice(0, 100);
      if (permissions !== void 0) {
        if (!Array.isArray(permissions)) {
          return res.status(400).json({ error: "Format permissions tidak valid." });
        }
        sanitizedUpdates.permissions = Array.from(
          new Set(permissions.map((p) => String(p).trim()).filter((p) => ALL_VALID_PERMISSIONS.has(p)))
        );
      }
      if (isActive !== void 0) sanitizedUpdates.isActive = Boolean(isActive);
      if (emailVerified !== void 0 && isSuper) sanitizedUpdates.emailVerified = Boolean(emailVerified);
      if (password !== void 0 && typeof password === "string" && password.length > 0) {
        if (password.length < 6) {
          return res.status(400).json({ error: "Kata sandi minimal 6 karakter." });
        }
        sanitizedUpdates.password = password;
      }
    }
    if (sanitizedUpdates.email) {
      const cleanEmail = String(sanitizedUpdates.email).trim().toLowerCase();
      const existing = db.getUsers().find((u) => u.email.toLowerCase() === cleanEmail && u.id !== req.params.id);
      if (existing) {
        return res.status(400).json({ error: `Alamat email "${cleanEmail}" sudah digunakan oleh akun lain (${existing.name}).` });
      }
      sanitizedUpdates.email = cleanEmail;
    }
    const updated = await db.updateUser(req.params.id, sanitizedUpdates);
    if (!updated) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    }
    res.json(updated);
  } catch (err) {
    console.error("[API Update User Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan pembaruan pengguna ke database." });
  }
});
app.post("/api/users/:id/reset-password", requireAuth, async (req, res) => {
  try {
    const isSuper = req.user?.role === "Super Admin Yayasan" || req.user?.email === "master@dev.com";
    const isYys = req.user?.role === "Admin Yayasan" || req.user?.email === "adminyys@dev.com" || req.user?.role?.includes("Admin Yayasan");
    const hasPerm = req.user?.permissions?.includes("Kelola Users") || req.user?.permissions?.includes("Kelola Users:edit");
    if (!isSuper && !isYys && !hasPerm) {
      return res.status(403).json({ error: "Akses Ditolak: Anda tidak memiliki izin mereset kata sandi pengguna." });
    }
    const target = db.getUsers().find((u) => u.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    }
    if (!isSuper) {
      const isTargetMaster = target.role === "Super Admin Yayasan" || target.email === "master@dev.com" || target.role?.includes("Super Admin");
      const isTargetYys = target.role === "Admin Yayasan" || target.email === "adminyys@dev.com" || target.role?.includes("Admin Yayasan") && !target.role?.includes("Super");
      if (isTargetMaster || isTargetYys) {
        return res.status(403).json({ error: "Akses Ditolak: Akun Master dan Admin Yayasan dilindungi sistem." });
      }
      if (!isYys && req.user?.schoolId && req.user.schoolId !== "MASTER" && target.schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: `Pelanggaran Batas Unit: Anda hanya berhak mereset akun unit ${req.user.schoolId}.` });
      }
    }
    const tokenResult = db.createPasswordResetToken(target.id);
    if (!tokenResult.success) {
      const status = tokenResult.cooldownSeconds ? 429 : 400;
      return res.status(status).json({ error: tokenResult.error });
    }
    const appBaseUrl = getConfiguredAppUrl(req);
    const resetLink = `${appBaseUrl}/?resetToken=${encodeURIComponent(tokenResult.rawToken)}`;
    const mailOutcome = await sendMailWithActiveSmtp({
      to: target.email,
      subject: "\u{1F510} Tautan Atur Ulang Kata Sandi Portal PPDB (Oleh Administrator)",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #16a34a; border-radius: 16px; overflow: hidden; background: #ffffff;">
          <div style="background-color: #14532d; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">YAYASAN AR-RISALAH ACEH</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Reset Kata Sandi Akun Portal PPDB</p>
          </div>
          <div style="padding: 28px 24px; color: #1e293b;">
            <p style="font-size: 14px; line-height: 1.6;">
              Assalamu'alaikum <strong>${escapeHtml(target.name)}</strong>,<br/>
              Administrator (${escapeHtml(req.user?.name || req.user?.email)}) mengirimkan tautan aman sekali pakai untuk mengatur ulang kata sandi akun Anda (<strong>${escapeHtml(target.email)}</strong>).
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${escapeHtml(resetLink)}" style="display: inline-block; background-color: #15803d; color: #ffffff; text-decoration: none; font-weight: bold; padding: 14px 26px; border-radius: 10px; font-size: 14px;">
                Buat Kata Sandi Baru
              </a>
            </div>
            <p style="font-size: 12px; color: #64748b; word-break: break-all;">
              Salin tautan berikut bila tombol tidak berfungsi:<br/>${escapeHtml(resetLink)}
            </p>
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px; font-size: 12px; color: #92400e;">
              Tautan ini berlaku <strong>15 menit</strong> untuk <strong>1 kali penggunaan</strong>.
            </div>
          </div>
        </div>
      `
    });
    if (!mailOutcome.sent) {
      return res.status(503).json({
        error: "Layanan email SMTP belum aktif atau gagal mengirim email reset. Aktifkan SMTP atau ubah kata sandi langsung melalui form Edit User."
      });
    }
    addAuditLog(
      "update_status",
      target.schoolId || "MASTER",
      `Admin ${req.user?.email} mengirim tautan reset kata sandi sekali pakai ke ${target.email}`,
      req.user?.email || "admin",
      req.ip || "127.0.0.1"
    );
    res.json({
      success: true,
      message: `Tautan reset kata sandi aman (berlaku 15 menit) telah dikirim ke email ${target.email}.`
    });
  } catch (err) {
    console.error("[Admin Reset Password Error]:", err);
    res.status(500).json({ error: "Gagal memproses reset kata sandi." });
  }
});
app.delete("/api/users/:id", requireAuth, async (req, res) => {
  try {
    const isSuper = req.user?.role === "Super Admin Yayasan" || req.user?.email === "master@dev.com";
    const isYys = req.user?.role === "Admin Yayasan" || req.user?.email === "adminyys@dev.com" || req.user?.role?.includes("Admin Yayasan");
    const hasPerm = req.user?.permissions?.includes("Kelola Users") || req.user?.permissions?.includes("Kelola Users:delete");
    if (!isSuper && !isYys && !hasPerm) {
      return res.status(403).json({ error: "Akses Ditolak: Anda tidak memiliki izin menghapus staf." });
    }
    const target = db.getUsers().find((u) => u.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    }
    if (!isSuper) {
      const isTargetMaster = target.role === "Super Admin Yayasan" || target.email === "master@dev.com" || target.role?.includes("Super Admin");
      const isTargetYys = target.role === "Admin Yayasan" || target.email === "adminyys@dev.com" || target.role?.includes("Admin Yayasan") && !target.role?.includes("Super");
      if (isTargetMaster || isTargetYys) {
        return res.status(403).json({
          error: "Akses Ditolak: Akun Master dan Admin Yayasan dilindungi sistem dan tidak dapat dihapus."
        });
      }
      if (!isYys && req.user?.schoolId && req.user.schoolId !== "MASTER" && target.schoolId !== req.user.schoolId) {
        return res.status(403).json({
          error: `Pelanggaran Batas Unit: Anda hanya berhak menghapus akun unit ${req.user.schoolId}.`
        });
      }
    }
    const actor = req.user?.email || req.user?.name || "Admin";
    const actorRole = req.user?.role || "Staff";
    const success = await db.deleteUser(req.params.id, actor, actorRole);
    if (!success) {
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    }
    res.json({ success });
  } catch (err) {
    console.error("[API Delete User Error]:", err);
    res.status(500).json({ error: "Gagal menghapus pengguna dari database." });
  }
});
app.get("/api/academic-years", (req, res) => {
  res.json(db.getAcademicYears());
});
app.post("/api/academic-years", requireAuth, requireMaster, async (req, res) => {
  try {
    const { year, yearLabel, startDate, endDate } = req.body || {};
    const label = String(year || yearLabel || "").trim();
    if (!label || label.length > 50) {
      return res.status(400).json({ error: "Label tahun ajaran wajib diisi (maks 50 karakter)." });
    }
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(startDate)) || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) {
      return res.status(400).json({ error: "Tanggal mulai dan selesai wajib berformat YYYY-MM-DD." });
    }
    const newAy = await db.createAcademicYear({
      year: label,
      startDate: String(startDate),
      endDate: String(endDate)
    });
    res.status(201).json(newAy);
  } catch (err) {
    console.error("[API Create Academic Year Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan tahun ajaran baru ke database." });
  }
});
app.post("/api/academic-years/:id/activate", requireAuth, requireMaster, async (req, res) => {
  try {
    const ok = await db.activateAcademicYear(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: "Periode tahun ajaran tidak ditemukan." });
    }
    res.json({ message: "Tahun ajaran berhasil diaktifkan." });
  } catch (err) {
    console.error("[API Activate Academic Year Error]:", err);
    res.status(500).json({ error: "Gagal mengaktifkan tahun ajaran di database." });
  }
});
app.get("/api/landing-config", (req, res) => {
  const cfg = db.getLandingConfig();
  const { customLogoBase64, customFaviconBase64, ...rest } = cfg || {};
  res.json({
    ...rest,
    appUrl: getConfiguredAppUrl(req)
  });
});
app.put("/api/landing-config", requireAuth, requireMaster, async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ error: "Payload konfigurasi landing page tidak valid." });
    }
    if (body.logoUrl && !isSafeHttpUrl(body.logoUrl, true) && !String(body.logoUrl).startsWith("data:image/")) {
      return res.status(400).json({ error: "URL logo landing page tidak valid atau tidak aman." });
    }
    if (body.faviconUrl && !isSafeHttpUrl(body.faviconUrl, true) && !String(body.faviconUrl).startsWith("data:image/")) {
      return res.status(400).json({ error: "URL favicon landing page tidak valid atau tidak aman." });
    }
    if (body.canonicalUrl && String(body.canonicalUrl).trim() !== "" && !isSafeHttpUrl(body.canonicalUrl, false)) {
      return res.status(400).json({ error: "Canonical URL harus diawali http:// atau https://." });
    }
    if (body.ogImage && String(body.ogImage).trim() !== "" && !isSafeHttpUrl(body.ogImage, true)) {
      return res.status(400).json({ error: "URL OG Image tidak aman." });
    }
    if (body.structuredDataJson && String(body.structuredDataJson).trim() !== "") {
      try {
        JSON.parse(String(body.structuredDataJson));
      } catch {
        return res.status(400).json({ error: "Structured Data JSON-LD tidak valid." });
      }
    }
    if (Array.isArray(body.heroSlides)) {
      for (const slide of body.heroSlides) {
        if (slide?.imageUrl && !isSafeHttpUrl(slide.imageUrl, true) && !String(slide.imageUrl).startsWith("data:image/")) {
          return res.status(400).json({ error: "URL gambar slide hero tidak valid." });
        }
        if (slide?.buttonLink && String(slide.buttonLink).trim() !== "" && !String(slide.buttonLink).startsWith("#") && !isSafeHttpUrl(slide.buttonLink, true)) {
          return res.status(400).json({ error: "Tautan tombol slide hero tidak aman." });
        }
      }
    }
    const actor = req.user?.email || req.user?.name || "Master Admin";
    const actorRole = req.user?.role || "Super Admin Yayasan";
    const updated = await db.updateLandingConfig(body, actor, actorRole);
    syncActiveLogoToDefaultFile();
    const { customLogoBase64, customFaviconBase64, ...cleanUpdated } = updated || {};
    res.json({
      ...cleanUpdated,
      appUrl: getConfiguredAppUrl(req)
    });
  } catch (err) {
    console.error("[API Update Landing Config Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan konfigurasi landing page ke database." });
  }
});
app.post("/api/upload", requireAuth, uploadRateLimiter, async (req, res) => {
  try {
    const { filename, data } = req.body || {};
    if (!data || typeof data !== "string") {
      return res.status(400).json({ error: "Data file gambar (base64) wajib disertakan." });
    }
    const check = verifyDataUriPayload(data, { allowPdf: false, allowIco: false });
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }
    const sanitizedName = (filename || "image").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30);
    const safeFilename = `${Date.now()}_${sanitizedName}.${check.ext}`;
    const filePath = path2.join(uploadsDir, safeFilename);
    await fs2.promises.writeFile(filePath, check.buffer);
    const dataFilePath = path2.join(dataUploadsDir, safeFilename);
    await fs2.promises.writeFile(dataFilePath, check.buffer).catch(() => {
    });
    const fileUrl = `/uploads/${safeFilename}`;
    res.json({
      success: true,
      url: fileUrl,
      filename: safeFilename,
      sizeKB: Math.round(check.buffer.length / 1024)
    });
  } catch (err) {
    console.error("[Upload API Error]:", err);
    res.status(500).json({ error: "Gagal mengunggah dan menyimpan file gambar ke server." });
  }
});
app.get("/api/audit-logs", requireAuth, requirePermission("Audit Log"), (req, res) => {
  res.json(db.getAuditLogs());
});
app.get("/api/audit-logs/verify-integrity", requireAuth, requirePermission("Audit Log"), (req, res) => {
  res.json(db.verifyAuditLogIntegrity());
});
app.post("/api/audit-logs", requireAuth, (req, res) => {
  if (isWaliRoleName(req.user?.role)) {
    return res.status(403).json({ error: "Akses Ditolak: Pengguna portal wali tidak dapat menulis log audit staf." });
  }
  const CLIENT_ALLOWED_ACTIONS = /* @__PURE__ */ new Set(["export_data", "export_config"]);
  const rawAction = String(req.body?.action || "").trim();
  if (!CLIENT_ALLOWED_ACTIONS.has(rawAction)) {
    return res.status(403).json({ error: "Aksi log audit harus dicatat otomatis oleh operasi backend." });
  }
  const details = typeof req.body?.details === "string" ? req.body.details.trim().slice(0, 500) : "Ekspor data oleh staf.";
  const email = req.user.email;
  const unit = req.user.schoolId || "MASTER";
  const log = addAuditLog(rawAction, unit, details, email, req.ip || "127.0.0.1");
  res.status(201).json(log);
});
app.get("/api/system-security-status", requireAuth, requirePermission("Status Sistem"), async (req, res) => {
  try {
    const tables = await db.getRealDbTables();
    const cf = getEnvCloudflareConfig();
    const smtp = db.getSmtpConfig();
    const auditIntegrity = db.verifyAuditLogIntegrity();
    const dbStatus = db.getDbStatus();
    res.json({
      database: dbStatus,
      tableCount: tables.length,
      tables: tables.map((t) => ({ name: t.name, rowCount: t.rowCount, isLiveMySQL: t.isLiveMySQL })),
      security: {
        appMode: isProd ? "production" : "development",
        authMechanism: "HttpOnly Cookie + HMAC-SHA256 Session + CSRF Token + Bcrypt (cost 10)",
        sessionDuration: "7 Hari (Auto-revoke saat ganti password/role/nonaktif)",
        corsAllowlistActive: !allowAllOriginsWildcard,
        corsWildcard: allowAllOriginsWildcard,
        rateLimits: {
          generalUnauth: isProd ? `${MAX_REQUESTS_UNAUTH} Req / 5 Menit` : "Mode Development (Non-blocking)",
          generalAuth: isProd ? `${MAX_REQUESTS_AUTH} Req / 5 Menit` : "Mode Development (Non-blocking)",
          authSensitive: `${MAX_AUTH_ATTEMPTS} Req / 1 Menit`,
          otp: isProd ? "10 Req / 10 Menit" : "Mode Development (Non-blocking)",
          publicLookup: isProd ? "30 Req / 5 Menit" : "Mode Development (Non-blocking)",
          upload: isProd ? "40 Req / 5 Menit" : "Mode Development (Non-blocking)"
        },
        cloudflareEnabled: cf.enabled,
        cloudflareManagedByEnv: true,
        smtpEnabled: Boolean(smtp.enabled),
        smtpVerified: Boolean(smtp.isVerified),
        auditIntegrity,
        securityHeaders: [
          "HttpOnly Session Cookie + X-CSRF-Token",
          "Content-Security-Policy",
          "X-Content-Type-Options: nosniff",
          "X-Frame-Options: SAMEORIGIN",
          "Referrer-Policy: strict-origin-when-cross-origin",
          "Permissions-Policy"
        ]
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal memuat status keamanan sistem." });
  }
});
app.get("/api/database/sql-dump", requireAuth, requireRole(["Super Admin Yayasan"]), (req, res) => {
  const sql = db.getSqlDump();
  res.setHeader("Content-Type", "application/sql");
  res.setHeader("Content-Disposition", 'attachment; filename="ppdb_arrisalah_mysql.sql"');
  res.send(sql);
});
var REAL_DB_PIN_WINDOW_MS = 5 * 60 * 1e3;
var MAX_REAL_DB_PIN_ATTEMPTS = 50;
var realDbPinRateLimiter = (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const now = Date.now();
  const attempt = realDbPinRateLimitMap.get(ip);
  if (!attempt || now > attempt.resetTime) {
    realDbPinRateLimitMap.set(ip, { count: 1, resetTime: now + REAL_DB_PIN_WINDOW_MS });
    return next();
  }
  if (attempt.count >= MAX_REAL_DB_PIN_ATTEMPTS) {
    return res.status(429).json({
      error: "Terlalu banyak percobaan PIN keamanan database. Silakan coba lagi sebentar."
    });
  }
  attempt.count++;
  next();
};
var requireRealDbAccess = (req, res, next) => {
  const dbToken = req.headers["x-db-access-token"];
  if (!dbToken || !db.verifyRealDbAccessToken(dbToken)) {
    return res.status(401).json({
      error: "Akses Ditolak: PIN Keamanan Database diperlukan atau sesi inspeksi database telah kedaluwarsa."
    });
  }
  next();
};
app.post(
  "/api/real-db/verify-pin",
  requireAuth,
  requireRole(["Super Admin Yayasan"]),
  realDbPinRateLimiter,
  (req, res) => {
    const { pin } = req.body;
    if (!pin || typeof pin !== "string") {
      return res.status(400).json({ error: "PIN keamanan wajib diisi." });
    }
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const result = db.verifyRealDbPin(pin.trim(), ip);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    realDbPinRateLimitMap.delete(ip);
    res.json(result);
  }
);
app.post(
  "/api/real-db/revoke-pin",
  requireAuth,
  requireRole(["Super Admin Yayasan"]),
  (req, res) => {
    const dbToken = req.headers["x-db-access-token"];
    if (dbToken) {
      db.revokeRealDbAccessToken(dbToken);
    }
    res.json({ success: true, message: "Sesi inspeksi database telah dikunci kembali." });
  }
);
app.get(
  "/api/real-db/tables",
  requireAuth,
  requireRole(["Super Admin Yayasan"]),
  requireRealDbAccess,
  async (req, res) => {
    try {
      const tables = await db.getRealDbTables();
      res.json(tables);
    } catch (err) {
      res.status(500).json({ error: "Gagal memuat daftar tabel database.", message: err.message });
    }
  }
);
app.get(
  "/api/real-db/table/:tableName",
  requireAuth,
  requireRole(["Super Admin Yayasan"]),
  requireRealDbAccess,
  async (req, res) => {
    try {
      const { tableName } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;
      const search = req.query.search || "";
      const data = await db.getRealDbTableData(tableName, page, limit, search);
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: err.message || "Gagal memuat isi tabel database." });
    }
  }
);
app.post("/api/auth/register-wali", authRateLimiter, async (req, res) => {
  try {
    const { name, email, phone, password, turnstileToken } = req.body || {};
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const cfCheck = await verifyTurnstileServer(turnstileToken, ip);
    if (!cfCheck.success) {
      return res.status(400).json({ error: cfCheck.error });
    }
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: "Nama lengkap, email, nomor WhatsApp, dan kata sandi wajib diisi." });
    }
    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Format email tidak valid." });
    }
    if (typeof phone !== "string" || phone.replace(/\D/g, "").length < 9) {
      return res.status(400).json({ error: "Nomor WhatsApp minimal 9 digit angka." });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Kata sandi minimal 6 karakter demi keamanan." });
    }
    const result = await db.registerWaliAccount({ name, email, phone, password }, ip);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const csrfToken = result.token ? setAuthCookies(req, res, result.token) : "";
    res.status(201).json({
      success: true,
      user: result.user,
      csrfToken
    });
  } catch (err) {
    console.error("[Register Wali Error]:", err);
    res.status(500).json({ error: "Gagal memproses pendaftaran akun wali." });
  }
});
app.post("/api/auth/send-verification-otp", requireAuth, otpRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Autentikasi diperlukan." });
    }
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const result = db.generateEmailVerificationOtp(userId, ip);
    if (!result.success || !result.email || !result.otp) {
      return res.status(400).json({ error: result.error || "Gagal membuat kode OTP verifikasi.", cooldownSeconds: result.cooldownSeconds });
    }
    const recipientEmail = result.email;
    const otpCode = result.otp;
    const mailOutcome = await sendMailWithActiveSmtp({
      to: recipientEmail,
      subject: `\u{1F510} Kode OTP Verifikasi Email PPDB - Yayasan Ar-Risalah Aceh`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #16a34a; border-radius: 16px; overflow: hidden; background: #ffffff;">
          <div style="background-color: #14532d; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">YAYASAN AR-RISALAH ACEH</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Penerimaan Peserta Didik Baru (PPDB) ${escapeHtml(getActiveAcademicYearLabel(db.getAcademicYears()))}</p>
          </div>
          <div style="padding: 28px 24px; color: #1e293b;">
            <h3 style="color: #14532d; margin-top: 0; font-size: 16px;">Verifikasi Alamat Email Akun Wali Siswa</h3>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Assalamu'alaikum Warahmatullahi Wabarakatuh.<br/>
              Gunakan kode OTP 6-digit di bawah ini untuk memverifikasi alamat email <strong>${escapeHtml(recipientEmail)}</strong>:
            </p>
            <div style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; color: #15803d; display: block; margin-bottom: 6px;">KODE VERIFIKASI OTP:</span>
              <span style="font-size: 32px; font-weight: 800; font-family: monospace; letter-spacing: 6px; color: #14532d;">${escapeHtml(otpCode)}</span>
            </div>
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px; font-size: 12px; color: #92400e;">
              <strong>Perhatian:</strong> Kode ini hanya berlaku selama <strong>10 menit</strong>. Jangan pernah membagikan kode OTP ini kepada siapapun demi keamanan akun Anda.
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 24px; line-height: 1.5;">
              Setelah email terverifikasi, kartu tanda peserta seleksi dan bukti pembayaran pendaftaran ananda akan otomatis dikirimkan ke email ini.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} Panitia PPDB Yayasan Ar-Risalah Aceh \u2022 Email Resmi Sistem
          </div>
        </div>
      `
    });
    if (!mailOutcome.sent) {
      return res.status(503).json({
        success: false,
        error: "Layanan email SMTP belum aktif atau gagal mengirim kode OTP. Silakan hubungi Panitia PPDB."
      });
    }
    res.json({
      success: true,
      message: `Kode OTP 6-digit telah dikirim ke email ${recipientEmail}.`,
      sentVia: "smtp",
      cooldownSeconds: 60
    });
  } catch (err) {
    console.error("[Send OTP Error]:", err);
    res.status(500).json({ error: "Gagal mengirim kode OTP verifikasi email." });
  }
});
app.post("/api/auth/verify-verification-otp", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Autentikasi diperlukan." });
    }
    const { otp } = req.body;
    if (!otp || typeof otp !== "string") {
      return res.status(400).json({ error: "Kode OTP wajib diisi." });
    }
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const result = await db.verifyEmailVerificationOtp(userId, otp, ip);
    if (!result.success) {
      return res.status(400).json({ error: result.error, attemptsLeft: result.attemptsLeft });
    }
    res.json(result);
  } catch (err) {
    console.error("[Verify OTP Error]:", err);
    res.status(500).json({ error: "Gagal memverifikasi kode OTP." });
  }
});
app.post("/api/auth/verify-email", requireAuth, requireRole(["Super Admin Yayasan"]), async (req, res) => {
  try {
    const targetUserId = typeof req.body?.userId === "string" && req.body.userId.trim() ? req.body.userId.trim() : req.user?.id;
    if (!targetUserId) {
      return res.status(400).json({ error: "ID pengguna tidak valid." });
    }
    const result = await db.verifyWaliEmail(targetUserId);
    res.json(result);
  } catch (err) {
    console.error("[Verify Email Error]:", err);
    res.status(500).json({ error: "Gagal memverifikasi email ke database." });
  }
});
app.post("/api/students/offline", requireAuth, requirePermission("Pendaftar", "add"), requireUnitIsolation, async (req, res) => {
  try {
    const {
      fullName,
      unit: rawUnit,
      nisn,
      gender,
      birthPlace,
      birthDate,
      address,
      parentName,
      parentPhone,
      parentJob,
      parentIncome,
      track,
      schoolOrigin,
      documents,
      dynamicAnswers
    } = req.body || {};
    const unit = typeof rawUnit === "string" ? rawUnit.trim().toUpperCase() : "";
    const validUnits = db.getUnits();
    const targetUnit = validUnits.find((u) => u.id === unit);
    if (!unit || !targetUnit) {
      return res.status(400).json({ error: "Unit sekolah tujuan tidak valid atau tidak terdaftar." });
    }
    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2 || fullName.length > 200) {
      return res.status(400).json({ error: "Nama lengkap calon siswa wajib diisi (2-200 karakter)." });
    }
    if (parentName !== void 0 && typeof parentName !== "string") {
      return res.status(400).json({ error: "Format nama wali tidak valid." });
    }
    if (parentPhone !== void 0 && typeof parentPhone !== "string") {
      return res.status(400).json({ error: "Format nomor telepon tidak valid." });
    }
    let sanitizedNisn = "";
    if (nisn && typeof nisn === "string" && nisn.trim().length > 0) {
      const cleanNisn = nisn.replace(/\D/g, "");
      if (cleanNisn.length !== 10) {
        return res.status(400).json({ error: "NISN harus tepat 10 digit angka jika diisi." });
      }
      const existingNisn = db.getStudents().find((s) => s.nisn && s.nisn.trim() === cleanNisn);
      if (existingNisn) {
        return res.status(409).json({
          error: `Calon siswa dengan NISN ${cleanNisn} sudah terdaftar sebelumnya (${existingNisn.registrationNumber}).`
        });
      }
      sanitizedNisn = cleanNisn;
    }
    const isSafeDocVal = (val) => {
      if (val === "") return true;
      if (typeof val !== "string" || val.length > 8 * 1024 * 1024) return false;
      if (val.startsWith("data:")) return verifyDataUriPayload(val, { allowPdf: true }).ok;
      return isSafeHttpUrl(val, true);
    };
    const sanitizedDocs = {};
    if (documents && typeof documents === "object" && !Array.isArray(documents)) {
      for (const [k, v] of Object.entries(documents)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype" || !v) continue;
        if (!isSafeDocVal(v)) {
          return res.status(400).json({ error: `Format dokumen "${k}" tidak valid.` });
        }
        sanitizedDocs[k] = String(v);
      }
    }
    const sanitizedAnswers = {};
    if (dynamicAnswers && typeof dynamicAnswers === "object" && !Array.isArray(dynamicAnswers)) {
      for (const [k, v] of Object.entries(dynamicAnswers)) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
        if (typeof v === "string" && v.startsWith("data:") && !isSafeDocVal(v)) {
          return res.status(400).json({ error: `Format berkas pada kolom "${k}" tidak diizinkan.` });
        }
        sanitizedAnswers[k] = v;
      }
    }
    const recordedBy = req.user?.email || "admin@arrisalahaceh.or.id";
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const newStudent = await db.addOfflineStudent(
      {
        fullName: fullName.trim().slice(0, 200),
        nisn: sanitizedNisn,
        unit,
        gender: gender === "Perempuan" ? "Perempuan" : "Laki-laki",
        birthPlace: typeof birthPlace === "string" ? birthPlace.trim().slice(0, 100) : "",
        birthDate: typeof birthDate === "string" ? birthDate.trim().slice(0, 20) : "",
        address: typeof address === "string" ? address.trim().slice(0, 500) : "",
        parentName: typeof parentName === "string" ? parentName.trim().slice(0, 150) : "",
        parentPhone: typeof parentPhone === "string" ? parentPhone.trim().slice(0, 30) : "",
        parentJob: typeof parentJob === "string" ? parentJob.trim().slice(0, 100) : "",
        parentIncome: typeof parentIncome === "string" ? parentIncome.trim().slice(0, 60) : "",
        track: typeof track === "string" ? track.trim().slice(0, 50) : "Reguler",
        schoolOrigin: typeof schoolOrigin === "string" ? schoolOrigin.trim().slice(0, 150) : void 0,
        documents: sanitizedDocs,
        dynamicAnswers: sanitizedAnswers
      },
      recordedBy,
      ip
    );
    res.status(201).json(newStudent);
  } catch (err) {
    console.error("[Offline Register Error]:", err);
    res.status(500).json({ error: "Gagal mencatat pendaftaran offline ke database." });
  }
});
app.get("/api/export-configs", (req, res) => {
  res.json(db.getExportConfigs());
});
app.put("/api/export-configs", requireAuth, requireMaster, async (req, res) => {
  try {
    const { moduleName, roleId, allowedHeaders } = req.body;
    if (!moduleName || !roleId || !Array.isArray(allowedHeaders)) {
      return res.status(400).json({ error: "Data konfigurasi ekspor tidak valid." });
    }
    const updatedBy = req.user?.name || req.user?.email || "Master Admin";
    const saved = await db.saveExportConfig(
      { id: `${moduleName}_${roleId}`, moduleName, roleId, allowedHeaders, updatedAt: "", updatedBy },
      updatedBy
    );
    res.json(saved);
  } catch (err) {
    console.error("[Export Configs Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan konfigurasi ekspor ke database." });
  }
});
app.get("/api/cloudflare-config", (_req, res) => {
  const cf = getEnvCloudflareConfig();
  res.json({
    enabled: cf.enabled,
    siteKey: cf.enabled ? cf.siteKey : "",
    mode: "managed",
    appearance: "always",
    managedByEnv: true
  });
});
app.put("/api/cloudflare-config", requireAuth, requireRole(["Super Admin Yayasan"]), (_req, res) => {
  return res.status(403).json({
    error: "Konfigurasi Cloudflare Turnstile dikelola secara eksklusif melalui file .env server (CLOUDFLARE_ENABLED) demi keamanan dan tidak dapat diubah melalui dashboard."
  });
});
app.post("/api/verify-turnstile", authRateLimiter, async (req, res) => {
  const { token } = req.body || {};
  const cf = getEnvCloudflareConfig();
  if (!cf.enabled) {
    return res.json({ success: true, verified: true, message: "Cloudflare Turnstile non-aktif (CLOUDFLARE_ENABLED=false)." });
  }
  const check = await verifyTurnstileServer(token, req.ip || "");
  if (!check.success) {
    return res.status(400).json({ success: false, error: check.error });
  }
  return res.json({ success: true, verified: true });
});
app.get("/api/smtp-config", requireAuth, requireRole(["Super Admin Yayasan"]), (req, res) => {
  const config = db.getSmtpConfig();
  const rawPassword = db.getDecryptedSmtpPassword();
  const accounts = db.getDecryptedSmtpAccounts().map((acc) => ({
    ...acc,
    authPassword: acc.authPassword ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
    hasPassword: Boolean(acc.authPassword && acc.authPassword.length > 0)
  }));
  res.json({
    ...config,
    authPassword: rawPassword ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
    hasPassword: Boolean(rawPassword && rawPassword.length > 0),
    accounts
  });
});
app.put("/api/smtp-config", requireAuth, requireRole(["Super Admin Yayasan"]), async (req, res) => {
  try {
    const { enabled, host, port, secure, senderEmail, senderName, authPassword, accounts } = req.body;
    const current = db.getSmtpConfig();
    let passwordToSave = current.authPassword;
    if (authPassword !== void 0) {
      if (authPassword === "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") {
        passwordToSave = current.authPassword;
      } else if (typeof authPassword === "string" && authPassword.trim() === "") {
        passwordToSave = "";
      } else {
        passwordToSave = authPassword.trim();
      }
    }
    const actor = req.user?.email || req.user?.name || "Master Admin";
    const actorRole = req.user?.role || "Super Admin Yayasan";
    const saved = await db.saveSmtpConfig(
      {
        enabled: Boolean(enabled),
        host: host || "smtp.gmail.com",
        port: Number(port) || 465,
        secure: secure !== void 0 ? Boolean(secure) : true,
        senderEmail: senderEmail || "ppdb.arrisalah.aceh@gmail.com",
        senderName: senderName || "Panitia PPDB Yayasan Ar-Risalah Aceh",
        authPassword: passwordToSave,
        isVerified: current.isVerified,
        accounts: Array.isArray(accounts) ? accounts : current.accounts
      },
      actor,
      actorRole
    );
    const rawPassword = db.getDecryptedSmtpPassword();
    const savedAccounts = db.getDecryptedSmtpAccounts().map((acc) => ({
      ...acc,
      authPassword: acc.authPassword ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
      hasPassword: Boolean(acc.authPassword && acc.authPassword.length > 0)
    }));
    res.json({
      ...saved,
      authPassword: rawPassword ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
      hasPassword: Boolean(rawPassword && rawPassword.length > 0),
      accounts: savedAccounts
    });
  } catch (err) {
    console.error("[SMTP Config Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan konfigurasi SMTP ke database." });
  }
});
app.post("/api/smtp-config/test", requireAuth, requireRole(["Super Admin Yayasan"]), async (req, res) => {
  const { testRecipient, senderEmail, authPassword } = req.body;
  const smtp = db.getSmtpConfig();
  const accountsToTry = [];
  if (senderEmail && authPassword) {
    let rawPassword = authPassword.trim();
    if (rawPassword === "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") {
      const matched = db.getDecryptedSmtpAccounts().find(
        (a) => a.senderEmail.toLowerCase() === senderEmail.trim().toLowerCase()
      );
      rawPassword = matched?.authPassword || db.getDecryptedSmtpPassword();
    }
    accountsToTry.push({
      senderEmail: senderEmail.trim(),
      senderName: smtp.senderName || "Panitia PPDB Yayasan Ar-Risalah Aceh",
      authPassword: rawPassword,
      host: smtp.host || "smtp.gmail.com",
      port: Number(smtp.port) || 465,
      secure: smtp.secure !== void 0 ? smtp.secure : true
    });
  } else {
    const decryptedList = db.getDecryptedSmtpAccounts().filter((a) => a.isActive && a.authPassword);
    if (decryptedList.length > 0) {
      accountsToTry.push(...decryptedList);
    } else {
      const rootPass = db.getDecryptedSmtpPassword();
      if (smtp.senderEmail && rootPass) {
        accountsToTry.push({
          senderEmail: smtp.senderEmail,
          senderName: smtp.senderName || "Panitia PPDB Yayasan Ar-Risalah Aceh",
          authPassword: rootPass,
          host: smtp.host || "smtp.gmail.com",
          port: Number(smtp.port) || 465,
          secure: smtp.secure !== void 0 ? smtp.secure : true
        });
      }
    }
  }
  if (accountsToTry.length === 0) {
    return res.status(200).json({
      success: false,
      message: "Konfigurasi SMTP belum lengkap: Email pengirim dan Google App Password (16-karakter) wajib diisi terlebih dahulu sebelum menguji."
    });
  }
  const recipient = testRecipient && testRecipient.trim() || accountsToTry[0].senderEmail;
  let lastError = "";
  let successAccount = null;
  for (const acc of accountsToTry) {
    try {
      const transporter = nodemailer.createTransport({
        host: acc.host || "smtp.gmail.com",
        port: acc.port || 465,
        secure: acc.secure !== void 0 ? acc.secure : true,
        auth: {
          user: acc.senderEmail,
          pass: acc.authPassword.replace(/\s+/g, "")
        },
        connectionTimeout: 8e3
      });
      await transporter.verify();
      await transporter.sendMail({
        from: `"${acc.senderName || "PPDB Yayasan Ar-Risalah"}" <${acc.senderEmail}>`,
        to: recipient,
        subject: `\u2705 Tes Koneksi SMTP Google - Akun ${escapeHtml(acc.senderEmail)} Berhasil`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #16a34a; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #14532d; color: white; padding: 20px; text-align: center;">
              <h2 style="margin: 0;">YAYASAN AR-RISALAH ACEH</h2>
              <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Sistem Notifikasi Resmi PPDB ${escapeHtml(getActiveAcademicYearLabel(db.getAcademicYears()))}</p>
            </div>
            <div style="padding: 24px; color: #1e293b;">
              <h3 style="color: #16a34a; margin-top: 0;">Alhamdulillah! Koneksi SMTP Google Berhasil Terhubung</h3>
              <p>Email ini adalah konfirmasi bahwa akun SMTP Gmail <strong>${escapeHtml(acc.senderEmail)}</strong> aktif dan siap digunakan untuk pengiriman notifikasi kartu pendaftaran PPDB.</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
                <tr><td style="padding: 6px; font-weight: bold; width: 140px;">Akun Pengirim:</td><td>${escapeHtml(acc.senderEmail)}</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Host Server:</td><td>${escapeHtml(acc.host)}:${escapeHtml(acc.port)}</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Waktu Pengujian:</td><td>${escapeHtml((/* @__PURE__ */ new Date()).toLocaleString("id-ID"))} WIB</td></tr>
              </table>
            </div>
            <div style="background-color: #f0fdf4; padding: 12px; text-align: center; font-size: 12px; color: #15803d; border-top: 1px solid #dcfce7;">
              Ar-Risalah Aceh \u2022 Menginspirasi Generasi Qur'ani, Cerdas, dan Mandiri
            </div>
          </div>
        `
      });
      successAccount = acc;
      break;
    } catch (err) {
      lastError = err.message || "";
      console.warn(`[SMTP Test Failover]: Gagal pada akun ${acc.senderEmail}, mencoba akun berikutnya...`);
    }
  }
  if (successAccount) {
    smtp.isVerified = true;
    await db.saveSmtpConfig(smtp, req.user?.email || "Master Admin", req.user?.role || "Super Admin Yayasan", true);
    return res.json({
      success: true,
      message: `Alhamdulillah! Tes kirim email berhasil menggunakan akun "${successAccount.senderEmail}" ke ${recipient}. Konfigurasi SMTP aktif dan terverifikasi.`,
      usedAccount: successAccount.senderEmail
    });
  }
  return res.status(200).json({
    success: false,
    message: `Gagal mengirim email melalui akun SMTP: ${lastError}. Pastikan menggunakan Google App Password (16-karakter) dan 2-Step Verification aktif.`
  });
});
app.get("/api/group-links", (req, res) => {
  res.json(db.getGroupLinkConfigs());
});
app.put("/api/group-links", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (isWaliRoleName(user.role)) {
      return res.status(403).json({ error: "Akses Ditolak: Wali siswa tidak memiliki izin mengubah pengaturan link grup." });
    }
    const roleLower = (user.role || "").toLowerCase();
    const isSuperOrYys = user.role === "Super Admin Yayasan" || user.role === "Admin Yayasan" || roleLower.includes("admin yayasan") || roleLower.includes("super admin");
    const perms = user.permissions || [];
    const hasLandingPerm = perms.includes("Kelola Landing") || perms.includes("Kelola Landing:edit");
    if (!isSuperOrYys && !hasLandingPerm) {
      return res.status(403).json({ error: "Akses Ditolak: Anda tidak memiliki izin mengelola link grup PPDB." });
    }
    const rawUnitId = typeof req.body?.unitId === "string" ? req.body.unitId.trim().toUpperCase() : "";
    const validGroupUnits = ["ALL", ...db.getUnits().map((u) => u.id)];
    const { groupUrl, groupName, visibilityRule } = req.body;
    if (!rawUnitId || !validGroupUnits.includes(rawUnitId)) {
      return res.status(400).json({ error: "Target unit link grup tidak valid." });
    }
    if (!isSuperOrYys && user.schoolId && user.schoolId !== "MASTER" && rawUnitId !== user.schoolId) {
      return res.status(403).json({
        error: `Pelanggaran Batas Unit: Anda (${user.schoolId}) hanya berhak mengubah link grup untuk unit Anda.`
      });
    }
    if (!groupUrl || !groupName || !isSafeHttpUrl(groupUrl, false)) {
      return res.status(400).json({ error: "Nama grup dan URL link grup (http/https) yang valid wajib diisi." });
    }
    const cleanVisRule = ["always", "after_data", "after_payment"].includes(String(visibilityRule)) ? visibilityRule : "always";
    const saved = await db.saveGroupLinkConfig({
      unitId: rawUnitId,
      groupUrl: String(groupUrl).trim().slice(0, 500),
      groupName: String(groupName).trim().slice(0, 150),
      visibilityRule: cleanVisRule
    });
    res.json(saved);
  } catch (err) {
    console.error("[Group Links Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan link grup ke database." });
  }
});
app.get("/api/unit-contacts", (req, res) => {
  res.json(db.getUnitContacts());
});
app.put("/api/unit-contacts/:unitId", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (isWaliRoleName(user.role)) {
      return res.status(403).json({ error: "Akses Ditolak: Wali siswa tidak memiliki izin mengubah kontak unit." });
    }
    const roleLower = (user.role || "").toLowerCase();
    const isSuperOrYys = user.role === "Super Admin Yayasan" || roleLower.includes("admin yayasan") || roleLower.includes("super admin");
    const perms = user.permissions || [];
    const hasContactPerm = roleLower.includes("admin unit") || perms.includes("Kelola Landing") || perms.includes("Kelola Landing:edit") || perms.includes("Kelola Kontak") || perms.includes("Kelola Kontak:edit");
    if (!isSuperOrYys && !hasContactPerm) {
      return res.status(403).json({ error: "Akses Ditolak: Anda tidak memiliki izin mengelola kontak unit PPDB." });
    }
    const targetUnit = String(req.params.unitId || "").trim().toUpperCase();
    const allowedContactUnits = ["MASTER", ...db.getUnits().map((u) => u.id)];
    if (!allowedContactUnits.includes(targetUnit)) {
      return res.status(400).json({ error: "Unit ID kontak tidak valid." });
    }
    const { unitName, contactPerson, phone, whatsapp, email, officeHours, address, notes } = req.body || {};
    if (!isSuperOrYys && user.schoolId !== "MASTER") {
      if (targetUnit !== user.schoolId) {
        return res.status(403).json({
          error: `Akses Ditolak: Anda hanya dapat mengelola kontak untuk unit ${user.schoolId}.`
        });
      }
    }
    if (!contactPerson || typeof contactPerson !== "string" || !phone || !whatsapp) {
      return res.status(400).json({ error: "Nama penanggung jawab, nomor HP, dan WhatsApp wajib diisi." });
    }
    if (email && (typeof email !== "string" || !email.includes("@") || email.length > 150)) {
      return res.status(400).json({ error: "Format email kontak tidak valid." });
    }
    const updatedBy = user.name || user.email || "Admin";
    const saved = await db.saveUnitContact(
      {
        unitId: targetUnit,
        unitName: (typeof unitName === "string" && unitName.trim() ? unitName.trim() : `Unit ${targetUnit}`).slice(0, 120),
        contactPerson: contactPerson.trim().slice(0, 150),
        phone: String(phone).trim().slice(0, 40),
        whatsapp: String(whatsapp).replace(/[^0-9]/g, "").slice(0, 30),
        email: email ? String(email).trim().slice(0, 150) : "",
        officeHours: typeof officeHours === "string" && officeHours.trim() ? officeHours.trim().slice(0, 120) : "Senin - Sabtu (08:00 - 15:00 WIB)",
        address: typeof address === "string" ? address.trim().slice(0, 300) : "",
        notes: typeof notes === "string" ? notes.trim().slice(0, 400) : ""
      },
      updatedBy
    );
    res.json(saved);
  } catch (err) {
    console.error("[Unit Contacts Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan kontak unit ke database." });
  }
});
app.get("/api/letter-configs", (req, res) => {
  res.json(db.getLetterConfigs());
});
app.put("/api/letter-configs/:unitId", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (isWaliRoleName(user.role)) {
      return res.status(403).json({ error: "Akses Ditolak: Wali siswa tidak memiliki izin mengubah format surat panitia." });
    }
    const roleLower = (user.role || "").toLowerCase();
    const isSuperOrYys = user.role === "Super Admin Yayasan" || roleLower.includes("admin yayasan") || roleLower.includes("super admin");
    const perms = user.permissions || [];
    const hasLetterPerm = roleLower.includes("admin unit") || perms.includes("Kelola Landing") || perms.includes("Kelola Landing:edit");
    if (!isSuperOrYys && !hasLetterPerm) {
      return res.status(403).json({ error: "Akses Ditolak: Anda tidak memiliki izin mengelola format surat panitia." });
    }
    const targetUnit = String(req.params.unitId || "").trim().toUpperCase();
    const allowedUnits = ["MASTER", ...db.getUnits().map((u) => u.id)];
    if (!allowedUnits.includes(targetUnit)) {
      return res.status(400).json({ error: "Unit ID pengaturan surat tidak valid." });
    }
    const {
      unitName,
      committeeChairName,
      committeeChairNip,
      committeeRoleTitle,
      letterHeaderTitle,
      cardTitle,
      issueLocation,
      issueDate,
      examInstructions,
      stampNote,
      cardFields
    } = req.body;
    if (user.schoolId !== "MASTER" && user.role !== "Super Admin Yayasan" && !user.role.includes("Admin Yayasan")) {
      if (targetUnit !== user.schoolId) {
        return res.status(403).json({
          error: `Akses Ditolak: Anda hanya dapat mengelola format surat untuk unit ${user.schoolId}.`
        });
      }
    }
    if (!committeeChairName || typeof committeeChairName !== "string" || committeeChairName.trim().length === 0) {
      return res.status(400).json({ error: "Nama Ketua Panitia PPDB wajib diisi." });
    }
    let sanitizedCardFields = void 0;
    if (cardFields !== void 0) {
      if (!Array.isArray(cardFields) || cardFields.length > 30) {
        return res.status(400).json({ error: "Format cardFields tidak valid (maksimal 30 kolom)." });
      }
      const seenFieldIds = /* @__PURE__ */ new Set();
      sanitizedCardFields = [];
      for (const rawItem of cardFields) {
        if (typeof rawItem !== "object" || rawItem === null || Array.isArray(rawItem) || Object.prototype.hasOwnProperty.call(rawItem, "__proto__") || Object.prototype.hasOwnProperty.call(rawItem, "constructor") || Object.prototype.hasOwnProperty.call(rawItem, "prototype")) {
          return res.status(400).json({ error: "Item kolom kartu cetak tidak valid." });
        }
        const fId = typeof rawItem.fieldId === "string" ? rawItem.fieldId.trim() : "";
        const fLabel = typeof rawItem.label === "string" ? rawItem.label.trim() : "";
        const fSection = typeof rawItem.sectionTitle === "string" ? rawItem.sectionTitle.trim().slice(0, 150) : "";
        if (!fId || fId.length > 120 || !fLabel || fLabel.length > 150) {
          return res.status(400).json({ error: "Setiap kolom kartu wajib memiliki fieldId dan label yang valid." });
        }
        if (seenFieldIds.has(fId)) continue;
        seenFieldIds.add(fId);
        sanitizedCardFields.push(
          fSection ? { fieldId: fId, label: fLabel, sectionTitle: fSection } : { fieldId: fId, label: fLabel }
        );
      }
    }
    const sanitizedInstructions = Array.isArray(examInstructions) ? examInstructions.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 400)).slice(0, 10) : [];
    const existingUnitConfig = db.getLetterConfigs().find((l) => l.unitId === targetUnit);
    const updatedBy = user.name || user.email || "Admin";
    const saved = await db.saveLetterConfig(
      {
        unitId: targetUnit,
        unitName: typeof unitName === "string" && unitName.trim() ? unitName.trim().slice(0, 120) : `Unit ${targetUnit}`,
        committeeChairName: committeeChairName.trim().slice(0, 160),
        committeeChairNip: committeeChairNip ? String(committeeChairNip).trim().slice(0, 100) : "",
        committeeRoleTitle: committeeRoleTitle ? String(committeeRoleTitle).trim().slice(0, 120) : "Ketua Panitia PPDB",
        letterHeaderTitle: letterHeaderTitle ? String(letterHeaderTitle).trim().slice(0, 180) : "PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)",
        cardTitle: cardTitle ? String(cardTitle).trim().slice(0, 180) : "KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB",
        issueLocation: issueLocation ? String(issueLocation).trim().slice(0, 100) : "Bireuen",
        issueDate: issueDate ? String(issueDate).trim().slice(0, 80) : "",
        examInstructions: sanitizedInstructions,
        stampNote: stampNote ? String(stampNote).trim().slice(0, 250) : "",
        cardFields: sanitizedCardFields !== void 0 ? sanitizedCardFields : existingUnitConfig?.cardFields
      },
      updatedBy
    );
    res.json(saved);
  } catch (err) {
    console.error("[Letter Configs Error]:", err);
    res.status(500).json({ error: "Gagal menyimpan format surat panitia ke database." });
  }
});
var isMasterOrYayasanAdminUser = (user) => {
  if (!user || !user.isActive || isWaliRoleName(user.role)) return false;
  const roleLower = (user.role || "").toLowerCase();
  return user.role === "Super Admin Yayasan" || roleLower.includes("super admin") || roleLower.includes("admin yayasan");
};
var validateBankAccountPayload = (body) => {
  const bankName = typeof body?.bankName === "string" ? body.bankName.trim() : "";
  const rawBankCode = typeof body?.bankCode === "string" ? body.bankCode.trim().toUpperCase() : "";
  const rawAccountNumber = typeof body?.accountNumber === "string" ? body.accountNumber.trim() : "";
  const accountHolder = typeof body?.accountHolder === "string" ? body.accountHolder.trim() : "";
  const branch = typeof body?.branch === "string" ? body.branch.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  if (bankName.length < 2 || bankName.length > 100) {
    return { error: "Nama bank wajib diisi (2-100 karakter)." };
  }
  if (!/^[0-9\s-]{5,30}$/.test(rawAccountNumber)) {
    return { error: "Nomor rekening harus berupa angka (5-30 karakter, boleh menggunakan spasi atau tanda hubung)." };
  }
  const digitsOnly = rawAccountNumber.replace(/\D/g, "");
  if (digitsOnly.length < 5 || digitsOnly.length > 25) {
    return { error: "Nomor rekening harus memuat 5 sampai 25 digit angka." };
  }
  if (accountHolder.length < 2 || accountHolder.length > 120) {
    return { error: "Nama pemilik rekening (a.n.) wajib diisi (2-120 karakter)." };
  }
  if (rawBankCode.length > 20) {
    return { error: "Kode / singkatan bank maksimal 20 karakter." };
  }
  const derivedCode = rawBankCode || bankName.replace(/[^A-Za-z0-9\s]/g, " ").trim().split(/\s+/)[0]?.toUpperCase().slice(0, 12) || "BANK";
  return {
    data: {
      bankName: bankName.slice(0, 100),
      bankCode: derivedCode,
      accountNumber: rawAccountNumber.replace(/\s+/g, " ").slice(0, 30),
      digitsOnly,
      accountHolder: accountHolder.slice(0, 120),
      branch: branch.slice(0, 100),
      notes: notes.slice(0, 300),
      isActive: body?.isActive !== void 0 ? Boolean(body.isActive) : true,
      isPrimary: Boolean(body?.isPrimary)
    }
  };
};
app.get("/api/bank-accounts", optionalAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const allAccounts = await db.getBankAccountsFresh();
  if (isMasterOrYayasanAdminUser(req.user)) {
    return res.json(allAccounts);
  }
  return res.json(allAccounts.filter((b) => b.isActive));
});
app.post("/api/bank-accounts", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!isMasterOrYayasanAdminUser(user)) {
      addAuditLog(
        "unauthorized_access",
        user.schoolId || "MASTER",
        `Akses ditolak: ${user.email} (${user.role}) mencoba menambah rekening yayasan`,
        user.email,
        req.ip || "127.0.0.1"
      );
      return res.status(403).json({
        error: "Akses Ditolak (403 Forbidden): Hanya Master Admin dan Admin Yayasan yang dapat menambah rekening yayasan."
      });
    }
    const validated = validateBankAccountPayload(req.body);
    if ("error" in validated) {
      return res.status(400).json({ error: validated.error });
    }
    const existing = db.getBankAccounts();
    const isDuplicate = existing.some(
      (b) => b.accountNumber.replace(/\D/g, "") === validated.data.digitsOnly && b.bankName.toLowerCase() === validated.data.bankName.toLowerCase()
    );
    if (isDuplicate) {
      return res.status(409).json({
        error: `Rekening ${validated.data.bankName} dengan nomor ${validated.data.accountNumber} sudah terdaftar.`
      });
    }
    const actor = user.email || user.name || "Admin Yayasan";
    const updatedList = await db.saveBankAccount(
      {
        id: `bank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        bankName: validated.data.bankName,
        bankCode: validated.data.bankCode,
        accountNumber: validated.data.accountNumber,
        accountHolder: validated.data.accountHolder,
        branch: validated.data.branch,
        notes: validated.data.notes,
        isActive: validated.data.isActive,
        isPrimary: validated.data.isPrimary,
        sortOrder: existing.length + 1
      },
      actor
    );
    res.status(201).json(updatedList);
  } catch (err) {
    console.error("[Bank Accounts POST Error]:", err);
    res.status(500).json({ error: "Gagal menambahkan rekening bank yayasan." });
  }
});
app.put("/api/bank-accounts/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!isMasterOrYayasanAdminUser(user)) {
      addAuditLog(
        "unauthorized_access",
        user.schoolId || "MASTER",
        `Akses ditolak: ${user.email} (${user.role}) mencoba mengubah rekening yayasan (${req.params.id})`,
        user.email,
        req.ip || "127.0.0.1"
      );
      return res.status(403).json({
        error: "Akses Ditolak (403 Forbidden): Hanya Master Admin dan Admin Yayasan yang dapat mengubah rekening yayasan."
      });
    }
    const targetId = String(req.params.id || "").trim();
    const existingList = db.getBankAccounts();
    const existingTarget = existingList.find((b) => b.id === targetId);
    if (!existingTarget) {
      return res.status(404).json({ error: "Rekening bank yayasan tidak ditemukan." });
    }
    const validated = validateBankAccountPayload(req.body);
    if ("error" in validated) {
      return res.status(400).json({ error: validated.error });
    }
    const isDuplicate = existingList.some(
      (b) => b.id !== targetId && b.accountNumber.replace(/\D/g, "") === validated.data.digitsOnly && b.bankName.toLowerCase() === validated.data.bankName.toLowerCase()
    );
    if (isDuplicate) {
      return res.status(409).json({
        error: `Rekening ${validated.data.bankName} dengan nomor ${validated.data.accountNumber} sudah digunakan pada entri lain.`
      });
    }
    const actor = user.email || user.name || "Admin Yayasan";
    const updatedList = await db.saveBankAccount(
      {
        ...existingTarget,
        bankName: validated.data.bankName,
        bankCode: validated.data.bankCode,
        accountNumber: validated.data.accountNumber,
        accountHolder: validated.data.accountHolder,
        branch: validated.data.branch,
        notes: validated.data.notes,
        isActive: validated.data.isActive,
        isPrimary: validated.data.isPrimary
      },
      actor
    );
    res.json(updatedList);
  } catch (err) {
    console.error("[Bank Accounts PUT Error]:", err);
    res.status(500).json({ error: "Gagal memperbarui rekening bank yayasan." });
  }
});
app.delete("/api/bank-accounts/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!isMasterOrYayasanAdminUser(user)) {
      addAuditLog(
        "unauthorized_access",
        user.schoolId || "MASTER",
        `Akses ditolak: ${user.email} (${user.role}) mencoba menghapus rekening yayasan (${req.params.id})`,
        user.email,
        req.ip || "127.0.0.1"
      );
      return res.status(403).json({
        error: "Akses Ditolak (403 Forbidden): Hanya Master Admin dan Admin Yayasan yang dapat menghapus rekening yayasan."
      });
    }
    const targetId = String(req.params.id || "").trim();
    const actor = user.email || user.name || "Admin Yayasan";
    const updatedList = await db.deleteBankAccount(targetId, actor);
    if (!updatedList) {
      return res.status(404).json({ error: "Rekening bank yayasan tidak ditemukan." });
    }
    res.json(updatedList);
  } catch (err) {
    console.error("[Bank Accounts DELETE Error]:", err);
    res.status(500).json({ error: "Gagal menghapus rekening bank yayasan." });
  }
});
app.post("/api/mail/send-card", requireAuth, async (req, res) => {
  try {
    const { studentId } = req.body;
    const student = db.getStudentById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Calon siswa tidak ditemukan." });
    }
    const parentUser = req.user;
    if (!parentUser) {
      return res.status(401).json({ error: "Autentikasi diperlukan." });
    }
    if (isWaliRoleName(parentUser.role)) {
      const targetStudent = db.getStudentById(student.id);
      if (!targetStudent || !studentBelongsToWali(targetStudent, parentUser)) {
        return res.status(403).json({ error: "Akses Ditolak: Anda hanya dapat mengirim kartu pendaftaran milik putra/putri Anda sendiri." });
      }
    }
    if (!parentUser.emailVerified) {
      return res.json({
        sent: false,
        reason: "Email wali belum diverifikasi. Kartu ujian dan bukti nomor pendaftaran hanya dapat diunduh di layar portal."
      });
    }
    const smtp = db.getSmtpConfig();
    if (!smtp.enabled) {
      return res.json({
        sent: false,
        reason: "SMTP Google dinonaktifkan oleh administrator yayasan."
      });
    }
    const accounts = db.getDecryptedSmtpAccounts().filter((a) => a.isActive && a.authPassword);
    if (accounts.length === 0) {
      return res.json({
        sent: false,
        reason: "Belum ada akun SMTP Google yang aktif dengan kata sandi aplikasi 16-karakter."
      });
    }
    const landingConfig = db.getLandingConfig();
    const addressFromDb = landingConfig?.contact?.address || "Jl. BTN Kupula Indah, Geulanggang Gampong (Geulanggang Baro), Kec. Kota Juang, Kab. Bireuen, Aceh";
    const phoneFromDb = landingConfig?.contact?.phone || landingConfig?.contact?.whatsapp || "0812-6900-1234";
    const emailFromDb = landingConfig?.contact?.email || "info@arrisalahaceh.or.id";
    const appNameFromDb = landingConfig?.appName || "Yayasan Ar-Risalah Aceh";
    const allSchedules = db.getSchedules();
    const studentSchedule = student.testScheduleId ? allSchedules.find((s) => s.id === student.testScheduleId) || allSchedules.find((s) => s.unit === student.unit) || null : allSchedules.find((s) => s.unit === student.unit) || null;
    const pdfBuffer = await generateStudentCardPdfBuffer(student, studentSchedule, landingConfig);
    const cleanReg = student.registrationNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    const pdfFilename = `Kartu_PPDB_${cleanReg}_${student.fullName.replace(/\s+/g, "_")}.pdf`;
    let emailSent = false;
    let sentByAccount = "";
    let lastError = "";
    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      try {
        const transporter = nodemailer.createTransport({
          host: acc.host || "smtp.gmail.com",
          port: acc.port || 465,
          secure: acc.secure !== void 0 ? acc.secure : true,
          auth: {
            user: acc.senderEmail,
            pass: acc.authPassword.replace(/\s+/g, "")
          },
          connectionTimeout: 9e3
        });
        await transporter.sendMail({
          from: `"${acc.senderName || smtp.senderName || appNameFromDb}" <${acc.senderEmail}>`,
          to: parentUser.email,
          subject: `\u{1F4DC} Kartu Tanda Peserta Ujian PPDB & Lampiran PDF: ${student.fullName} (${student.registrationNumber})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #16a34a; border-radius: 16px; overflow: hidden; background: #ffffff;">
              <div style="background-color: #14532d; color: white; padding: 24px; text-align: center;">
                <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px; text-transform: uppercase;">${escapeHtml(appNameFromDb)}</h2>
                <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Penerimaan Peserta Didik Baru (PPDB) ${escapeHtml(getActiveAcademicYearLabel(db.getAcademicYears()))}</p>
              </div>

              <div style="padding: 26px 24px; color: #1e293b;">
                <h3 style="color: #15803d; margin-top: 0; font-size: 16px;">Assalamu'alaikum Warahmatullahi Wabarakatuh</h3>
                <p style="font-size: 13.5px; line-height: 1.6; color: #334155;">
                  Ahlan wa Sahlan, Bapak/Ibu <strong>${escapeHtml(parentUser.name)}</strong>.<br/>
                  Alhamdulillah, pendaftaran calon peserta didik baru ananda telah berhasil terverifikasi di sistem PPDB ${escapeHtml(appNameFromDb)}.
                </p>

                <div style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 16px; margin: 18px 0; text-align: center;">
                  <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; color: #15803d; display: block; margin-bottom: 4px;">NOMOR REGISTRASI PENDAFTARAN RESMI</span>
                  <span style="font-size: 22px; font-weight: 800; font-family: monospace; letter-spacing: 2px; color: #14532d;">${escapeHtml(student.registrationNumber)}</span>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; font-weight: bold; color: #64748b; width: 160px;">Nama Lengkap Ananda</td><td style="padding: 8px 4px; font-weight: bold; color: #0f172a;">: ${escapeHtml(student.fullName)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; font-weight: bold; color: #64748b;">Unit Sekolah Pilihan</td><td style="padding: 8px 4px; font-weight: bold; color: #15803d;">: ${escapeHtml(student.unit)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; font-weight: bold; color: #64748b;">Tanggal Pendaftaran</td><td style="padding: 8px 4px; color: #334155;">: ${escapeHtml(student.registeredAt)} WIB</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; font-weight: bold; color: #64748b;">Jadwal Seleksi/Observasi</td><td style="padding: 8px 4px; color: #334155;">: ${studentSchedule ? escapeHtml(`${studentSchedule.date} (${studentSchedule.startTime} - ${studentSchedule.endTime} WIB) di ${studentSchedule.room}`) : "Mengikuti gelombang seleksi unit"}</td></tr>
                </table>

                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 14px; margin-top: 20px; font-size: 12.5px; color: #065f46; line-height: 1.5;">
                  \u{1F4CE} <strong>Dokumen Terlampir:</strong> File PDF resmi <strong>${escapeHtml(pdfFilename)}</strong> telah dilampirkan pada email ini. Silakan cetak kartu tersebut untuk dibawa ananda saat hari pelaksanaan ujian seleksi/observasi.
                </div>
              </div>

              <div style="background-color: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11.5px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6;">
                <strong style="color: #1e293b; font-size: 12px;">Panitia PPDB ${escapeHtml(appNameFromDb)}</strong><br/>
                \u{1F4CD} ${escapeHtml(addressFromDb)}<br/>
                \u{1F4DE} Telp/WA: ${escapeHtml(phoneFromDb)} &nbsp;|&nbsp; \u2709\uFE0F Email: ${escapeHtml(emailFromDb)}
              </div>
            </div>
          `,
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBuffer,
              contentType: "application/pdf"
            }
          ]
        });
        emailSent = true;
        sentByAccount = acc.senderEmail;
        console.log(`[Mail Send] Sukses mengirim kartu PDF siswa ${student.fullName} via akun ${acc.senderEmail}`);
        break;
      } catch (err) {
        lastError = err.message || "";
        console.warn(`[Mail Send Failover]: Gagal mengirim via akun ${acc.senderEmail} (${lastError}), mencoba akun cadangan berikutnya...`);
      }
    }
    if (emailSent) {
      addAuditLog(
        "update_status",
        student.unit,
        `Kirim kartu pendaftaran PDF an. ${student.fullName} ke ${parentUser.email} via SMTP ${sentByAccount}`,
        parentUser.email,
        req.ip || "127.0.0.1"
      );
      return res.json({
        sent: true,
        message: `Kartu pendaftaran dan lampiran file PDF berhasil dikirim ke email ${parentUser.email} (via ${sentByAccount})!`,
        usedAccount: sentByAccount
      });
    }
    res.status(500).json({
      sent: false,
      error: `Gagal mengirim email kartu: Seluruh akun SMTP gagal (${lastError}). Silakan periksa pengaturan Sandi Aplikasi SMTP Google di menu Master Admin.`
    });
  } catch (err) {
    console.error("[Mail Send Error]:", err);
    res.status(500).json({ error: "Gagal mengirim email pendaftaran." });
  }
});
app.get("/api/verify-ttd", lookupRateLimiter, (req, res) => {
  const reg = String(req.query.reg || "").trim().toUpperCase();
  if (!reg || reg.length < 6 || reg.length > 60) {
    return res.status(400).json({ valid: false, message: "Nomor pendaftaran tidak diberikan atau format tidak valid." });
  }
  const students = db.getStudents();
  const found = students.find((s) => (s.registrationNumber || "").toUpperCase() === reg);
  if (found) {
    return res.json({
      valid: true,
      registrationNumber: found.registrationNumber,
      registeredAt: found.registeredAt,
      message: `Dokumen ini sah di TTD online dengan no pendaftar ${found.registrationNumber}`
    });
  } else {
    return res.json({
      valid: false,
      registrationNumber: reg,
      message: `Nomor pendaftaran ${reg} tidak ditemukan pada database resmi.`
    });
  }
});
app.get("/api/verify-resi", lookupRateLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const pid = String(req.query.pid || "").trim();
  const reg = String(req.query.reg || "").trim().toUpperCase();
  const sig = String(req.query.sig || "").trim().toLowerCase();
  if (!pid || pid.length < 3 || pid.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(pid)) {
    return res.status(400).json({
      valid: false,
      paymentId: pid,
      message: "Kode / ID resi pembayaran tidak diberikan atau formatnya tidak valid."
    });
  }
  if (reg && (reg.length < 3 || reg.length > 60 || !/^[a-zA-Z0-9_-]+$/.test(reg))) {
    return res.status(400).json({
      valid: false,
      paymentId: pid,
      message: "Format nomor pendaftaran pada tautan resi tidak valid."
    });
  }
  if (sig && !/^[a-f0-9]{16,64}$/.test(sig)) {
    return res.json({
      valid: false,
      paymentId: pid,
      message: "Tanda tangan digital resi tidak valid atau telah dimodifikasi."
    });
  }
  try {
    const allPayments = await db.getPaymentsFresh();
    const pay = allPayments.find((p) => p.id === pid);
    if (!pay || pay.status !== "lunas") {
      return res.json({
        valid: false,
        paymentId: pid,
        message: "Resi pembayaran tidak ditemukan atau pembayaran belum berstatus LUNAS di sistem resmi."
      });
    }
    if (reg && (pay.registrationNumber || "").toUpperCase() !== reg) {
      return res.json({
        valid: false,
        paymentId: pid,
        message: "Resi tidak cocok dengan nomor pendaftaran yang tertera."
      });
    }
    const expectedSig = computeReceiptSignature(pay.id, pay.registrationNumber);
    if (sig && !timingSafeEqualHex(sig, expectedSig)) {
      return res.json({
        valid: false,
        paymentId: pid,
        message: "Tanda tangan kriptografi resi tidak cocok. Resi ini tidak valid."
      });
    }
    const student = db.getStudentById(pay.registrationId);
    const schemas = db.getFormSchemas();
    const units = db.getUnits();
    const academicYears = db.getAcademicYears();
    const landing = db.getLandingConfig();
    const targetUnit = units.find((u) => u.id === pay.unit);
    const studentSchema = student ? schemas.find((s) => s.unitId === student.unit) : void 0;
    const resolvedName = student ? resolveStudentNameFromSchema(
      student,
      studentSchema ? { ...studentSchema, sections: ensureCoreNameFieldInSections(studentSchema.sections, studentSchema.unitId) } : void 0
    ) : pay.studentName;
    const billTranches = allPayments.filter(
      (p) => p.registrationId === pay.registrationId && p.type === pay.type && p.status === "lunas"
    ).map((p) => ({
      id: p.id,
      amount: p.amount,
      date: p.date,
      bankAccount: p.bankAccount || "Rekening Resmi Yayasan"
    }));
    return res.json({
      valid: true,
      paymentId: pay.id,
      registrationNumber: pay.registrationNumber,
      studentName: resolvedName || pay.studentName,
      unitId: pay.unit,
      unitName: targetUnit?.name || pay.unit,
      unitShortName: targetUnit?.shortName || pay.unit,
      paymentType: pay.type,
      amount: pay.amount,
      totalApprovedForBill: billTranches.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
      date: pay.date,
      bankAccount: pay.bankAccount || "Rekening Resmi Yayasan",
      status: "lunas",
      verificationNotes: pay.verificationNotes || "Pembayaran telah diverifikasi dan dinyatakan LUNAS.",
      academicYear: getActiveAcademicYearLabel(academicYears),
      appName: landing?.appName || "PPDB Yayasan Ar-Risalah Aceh",
      logoUrl: landing?.logoUrl || "",
      receiptSig: expectedSig,
      tranches: billTranches,
      message: `Valid atas nama pendaftar ${resolvedName || pay.studentName}`
    });
  } catch (err) {
    console.error("[API Verify Resi Error]:", err);
    return res.status(500).json({
      valid: false,
      paymentId: pid,
      message: "Terjadi kesalahan saat memverifikasi keaslian resi pembayaran."
    });
  }
});
app.get("/api/trash", requireAuth, requireRole(["Super Admin Yayasan"]), (req, res) => {
  try {
    let items = db.getTrashItems();
    const entityTypeFilter = typeof req.query.entityType === "string" ? req.query.entityType.trim() : "";
    const unitIdFilter = typeof req.query.unitId === "string" ? req.query.unitId.trim() : "";
    if (entityTypeFilter && entityTypeFilter !== "ALL") {
      items = items.filter((item) => item.entityType === entityTypeFilter);
    }
    if (unitIdFilter && unitIdFilter !== "ALL") {
      items = items.filter((item) => item.unitId === unitIdFilter);
    }
    res.json(items);
  } catch (err) {
    console.error("[API Get Trash Error]:", err);
    res.status(500).json({ error: "Gagal mengambil daftar sampah dari database." });
  }
});
app.post("/api/trash/:id/restore", requireAuth, requireRole(["Super Admin Yayasan"]), async (req, res) => {
  try {
    const trashId = String(req.params.id || "").trim();
    if (!trashId || trashId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(trashId)) {
      return res.status(400).json({ error: "ID item sampah tidak valid." });
    }
    const actor = req.user?.email || req.user?.name || "Master Admin";
    const result = await db.restoreTrashItem(trashId, actor);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error || "Gagal memulihkan data dari sampah." });
    }
    res.json({
      success: true,
      entityType: result.entityType,
      message: result.message,
      trashItems: db.getTrashItems()
    });
  } catch (err) {
    console.error("[API Restore Trash Error]:", err);
    res.status(500).json({ error: "Gagal memulihkan data dari sampah." });
  }
});
app.delete("/api/trash/:id", requireAuth, requireRole(["Super Admin Yayasan"]), async (req, res) => {
  try {
    const trashId = String(req.params.id || "").trim();
    if (!trashId || trashId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(trashId)) {
      return res.status(400).json({ error: "ID item sampah tidak valid." });
    }
    const actor = req.user?.email || req.user?.name || "Master Admin";
    const deleted = await db.permanentlyDeleteTrashItem(trashId, actor);
    if (!deleted) {
      return res.status(404).json({ error: "Item sampah tidak ditemukan." });
    }
    res.json({
      success: true,
      message: "Data berhasil dihapus permanen dari Sampah.",
      trashItems: db.getTrashItems()
    });
  } catch (err) {
    console.error("[API Permanent Delete Trash Error]:", err);
    res.status(500).json({ error: "Gagal menghapus permanen item dari sampah." });
  }
});
app.delete("/api/trash", requireAuth, requireRole(["Super Admin Yayasan"]), async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.name || "Master Admin";
    const deletedCount = await db.emptyTrash(actor);
    res.json({
      success: true,
      deletedCount,
      message: `Seluruh Sampah berhasil dikosongkan (${deletedCount} item dihapus permanen).`,
      trashItems: []
    });
  } catch (err) {
    console.error("[API Empty Trash Error]:", err);
    res.status(500).json({ error: "Gagal mengosongkan data sampah." });
  }
});
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Endpoint API tidak ditemukan." });
});
app.use((err, req, res, next) => {
  console.error("[API Error]:", err);
  res.status(500).json({
    error: "Terjadi kesalahan internal server yang aman.",
    message: isProd ? "Internal Server Error" : err.message
  });
});
async function startServer() {
  await initDatabase();
  syncActiveLogoToDefaultFile();
  const distPath = fs2.existsSync(path2.resolve(PROJECT_ROOT2, "dist", "index.html")) ? path2.resolve(PROJECT_ROOT2, "dist") : path2.resolve(process.cwd(), "dist");
  const serveBuiltFrontend = () => {
    const indexHtmlPath = path2.join(distPath, "index.html");
    if (!fs2.existsSync(indexHtmlPath)) {
      console.warn(
        `[PPDB Backend] PERINGATAN: ${indexHtmlPath} belum ditemukan. Jalankan "npm run build" sebelum menjalankan "node server.js".`
      );
    }
    app.use(
      express.static(distPath, {
        maxAge: "7d",
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          } else if (filePath.includes(`${path2.sep}assets${path2.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      })
    );
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(indexHtmlPath);
    });
  };
  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      if (fs2.existsSync(path2.join(distPath, "index.html"))) {
        console.warn("[PPDB Backend] Vite tidak tersedia, beralih ke folder build statis dist/.");
        serveBuiltFrontend();
      } else {
        throw viteErr;
      }
    }
  } else {
    serveBuiltFrontend();
  }
  app.listen(PORT, HOST, () => {
    console.log(`[PPDB Backend] Server berjalan di http://${HOST}:${PORT} (${isProd ? "production" : "development"})`);
  });
}
startServer().catch((err) => {
  console.error("[PPDB Backend] Fatal start error:", err);
});
