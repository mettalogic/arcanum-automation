#ifndef BROWSER_H
#define BROWSER_H

#include <QMainWindow>

#include <map>
using namespace std;

#include "filedata.h"

namespace Ui {
class Browser;
}

class Browser : public QMainWindow
{
    Q_OBJECT

public:
    explicit Browser(QWidget *parent = nullptr);
    ~Browser();

public slots:
	void fileSelected(const QString &name);
	void search();
	void getDataDir();

private:
    Ui::Browser *ui;
	map<QString, FileData*> filemap;
	bool initialised;   // to avoid some weird race conditions as constructor is slow
	QString datadir; // = "/home/tim/c/arcanum/browser/json/";

	void populate_fields();
	void load_settings();
	void save_settings();
};

#endif // BROWSER_H
