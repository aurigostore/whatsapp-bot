Saya ingin membuat bot whatsapp.
Sebelumnya kamu analisa dulu bot saya yang sudah ada si sini : D:\BOT\WA BOT LIST
bot itu sebelumnya sudah say pakai dan berjalan lancar, namun karena banyak sekali fitur fitur yang saya rasa tidak terpakai, saya ingin membuat ulang dengan fitur fitur utama saja. yaitu sebagai berikut :

Fitur - fitur utama : 
1. All user
a. Ketika user ketik "list" maka akan muncul list produk yang tersedia
b. Ketika user ketik nama produk, maka akan muncul deskripsi produk dan harganya
c. Ketika user ketik "pay" atau "payment" maka akan muncul gambar foto qris dan keterangan. yang diatur oleh admin nantinya
d. Ketika user ketik "rules" maka akan muncul rules grup

2. Admin 
a. admin bisa mengatur list produk (menambah, mengedit, menghapus)
perintahnya : 
.addlist nama produk | Deskripsi produk
.editlist nama produk | Deskripsi produk
.deletelist nama produk

b. admin bisa mengatur qris dan keterangan
.setpay | keterangan (sambil upload gambar qris)

c. admin bisa kick member 
perintahnya : 
.kick nomor whatsapp
bisa juga dengan membalas pesan user dan ketik .kick

d. admin bisa add member
.addmember nomor whatsapp

e. admin bisa add admin lain
.addadmin nomor whatsapp
bisa juga dengan membalas pesan user dan ketik .addadmin

f. admin bisa menghapus admin lain
.removeadmin nomor whatsapp
bisa juga dengan membalas pesan user dan ketik .removeadmin

g. admin bisa mengatur rules grup
.setrules | rules

h. admin bisa mengatur pesan sapaan
.setwelcome | sapaan (bisa juga sambil upload gambar)

i. admin bisa menutup grup (hanya admin yang bisa mengirim pesan)
.close

j. admin bisa membuka grup (semua member bisa mengirim pesan)
.open

i. admin bisa melakukan hidetag untuk mass tag all user
.hidetag pesan

j. admin bisa membalas pesan user dengan .proses, maka bot akan membalas
TRANSAKSI SEDANG DIPROSES 🕐
======================
⏰ Jam: HH:mm:ss WIB
📅 Tanggal : dd/mm/yyyy
📂 Grup : nama grup
📝 Pesanan : Deskripsi pesan yang dibalas
======================
Pesanan sedang kami proses
Mohon Ditunggu dulu ya kak ☺️

k. admin bisa membalas pesan user dengan .done, maka bot akan membalas 
TRANSAKSI BERHASIL ✅
=======================
⏰ Jam: HH:mm:ss WIB
📅 Tanggal : dd/mm/yyyy
📂 Grup : nama grup
📝 Pesanan : Deskripsi pesan yang dibalas
=======================
Yaeyy!!! Pesanan sudah berhasil
@Nomor whatsapp user Ditunggu next ordernya ya kak!! ☺️

3. Ketika ada member baru yang join ke grup, maka bot akan mengirim pesan sapaan dan rules grup
(akan di tentukan oleh admin)

