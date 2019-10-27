#include <QDir>
#include <QStringList>
#include <QSettings>
#include <QFileDialog>

#include <iostream>

#include "browser.h"
#include "ui_browser.h"

Browser::Browser(QWidget *parent) :
    QMainWindow(parent),
    ui(new Ui::Browser)
{
	initialised = false;

    ui->setupUi(this);

	ui->txtFileRaw->setTabStopDistance(40); // default is 80
	ui->txtFileParsed->setTabStopDistance(40); // default is 80
	ui->treeFile->setSortingEnabled(true);

	load_settings();
	if (datadir.isEmpty())
		getDataDir();

	populate_fields();

	initialised = true;
}

Browser::~Browser()
{
	delete ui;
}

void Browser::populate_fields()
{
	QDir d(datadir);
	QStringList filters;
	filters << "*.json";
	QFileInfoList fl = d.entryInfoList(filters, QDir::Files | QDir::Readable | QDir::NoDotAndDotDot, QDir::Name);
//    cout << "Got entries: " << fl.length() << endl;

	for (auto f : fl) {
		FileData* fd = new FileData(datadir + f.fileName(), f.size());
		QString name = f.fileName().left(f.fileName().length()-5);
		filemap[name] = fd;
		ui->cmbFileList->addItem(name);
	}
}

void Browser::load_settings()
{
	QSettings settings("mettalogic", "arcanum-browser");
	datadir = settings.value("/dirname").toString();
}

void Browser::save_settings()
{
	QSettings settings("mettalogic", "arcanum-browser");
	settings.setValue("/dirname", datadir);
}

void Browser::getDataDir()
{
//	cerr << "datadir was: " << datadir.toLatin1().data() << endl;
	QString dir = QFileDialog::getExistingDirectory(this, "Location of JSON files", datadir, QFileDialog::ShowDirsOnly);
	if (!dir.isEmpty()) {
		datadir = dir + "/";
//		cerr << "datadir now: " << datadir.toLatin1().data() << endl;
		save_settings();
	}
}

void Browser::fileSelected(const QString& name)
{
	if (!initialised) return;

	filemap[name]->populateRawData(ui->txtFileRaw);
	filemap[name]->populateParsedData(ui->txtFileParsed);
	filemap[name]->populateTree(ui->treeFile);
	filemap[name]->populateWiki(ui->txtWiki);
}

void Browser::search()
{
	// Search for string case insensitive in id, name requires?
	// Need file found in, name, desc, column, value
	ui->tblSearch->clear();
	ui->edtSearchWiki->clear();
	int matches = 0;
	// Had some problems with QT methods randomly inserting HTML so generating long strings for search results instead.
	QString html("<table>\n<tr><th>File</th><th>Id</th><th>Name</th><th>Columnn</th><th>Value</th></tr>\n");
	QString wiki("{| class=\"wikitable\"\n|-\n! Filename !! Id !! Name !! Column !! Value\n");
	for (auto const& [key, val] : filemap) {
		matches += val->populateSearch(ui->tblSearch, ui->edtSearch->text(), html, wiki);
		ui->tabs->setCurrentIndex(4);
	}
	if (matches) {
		ui->tblSearch->append(html + "</table>");
		ui->edtSearchWiki->appendPlainText(wiki + "|}\n");
	}
	ui->edtStatus->setText(matches == 0 ? "No matches" : QString::asprintf("Matches: %d", matches));
}
